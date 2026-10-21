package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreSecretCipher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

@Service
public class RuntimeService {

    private final RuntimeRepository repository;
    private final StoreSecretCipher secretCipher;
    private final tools.jackson.databind.ObjectMapper objectMapper;
    private final long snapshotTtlNanos;
    private final MeterRegistry meters;
    private final long featureDataTtlNanos;
    private Map<UUID, CachedFeatureData> featureDataCache = Map.of();
    private volatile CachedBootstrap cachedBootstrap;

    public RuntimeService(
            RuntimeRepository repository,
            StoreSecretCipher secretCipher,
            tools.jackson.databind.ObjectMapper objectMapper,
            MeterRegistry meters,
            @Value("${app.runtime.bootstrap-cache-ttl:60s}") Duration snapshotTtl,
            @Value("${app.runtime.feature-data-cache-ttl:5m}") Duration featureDataTtl
    ) {
        this.repository = repository;
        this.secretCipher = secretCipher;
        this.objectMapper = objectMapper;
        this.meters = meters;
        this.snapshotTtlNanos = snapshotTtl.toNanos();
        this.featureDataTtlNanos = featureDataTtl.toNanos();
    }

    @Transactional(readOnly = true)
    public CachedBootstrap bootstrap() {
        long now = System.nanoTime();
        CachedBootstrap current = cachedBootstrap;
        if (current != null && now - current.createdAtNanos() < snapshotTtlNanos) {
            meters.counter("runtime.bootstrap.cache", "result", "hit").increment();
            return current;
        }
        synchronized (this) {
            current = cachedBootstrap;
            if (current != null && now - current.createdAtNanos() < snapshotTtlNanos) {
                meters.counter("runtime.bootstrap.cache", "result", "hit").increment();
                return current;
            }
            meters.counter("runtime.bootstrap.cache", "result", "miss").increment();
            Timer.Sample sample = Timer.start(meters);
            RuntimeBootstrapResponse response;
            try {
                response = loadBootstrap();
            } finally {
                sample.stop(meters.timer("runtime.bootstrap.load"));
            }
            meters.summary("runtime.bootstrap.bots").record(response.bots().size());
            meters.summary("runtime.bootstrap.features").record(response.bots().stream().mapToInt(bot -> bot.features().size()).sum());
            try {
                meters.summary("runtime.bootstrap.payload.bytes").record(objectMapper.writeValueAsBytes(response).length);
            } catch (tools.jackson.core.JacksonException ignored) {
                // ETag generation below reports serialization failures consistently.
            }
            current = new CachedBootstrap(response, etag(response), now);
            cachedBootstrap = current;
            return current;
        }
    }

    private RuntimeBootstrapResponse loadBootstrap() {
        var botRows = repository.findRunnableBots();
        List<UUID> botIds = botRows.stream().map(RuntimeRepository.BotRow::id).toList();
        var featureRows = repository.findFeatures(botIds);
        Map<UUID, CachedFeatureData> featureData = loadFeatureData(featureRows);
        Map<UUID, List<RuntimeRepository.FeatureRow>> featuresByBot = new LinkedHashMap<>();
        for (var feature : featureRows) {
            featuresByBot.computeIfAbsent(feature.botId(), ignored -> new ArrayList<>()).add(feature);
        }

        var bots = botRows.stream().map(bot -> {
            var features = featuresByBot.getOrDefault(bot.id(), List.of()).stream().map(feature -> {
                var data = featureData.get(feature.configSetId());
                var secrets = new LinkedHashMap<String, String>();
                for (var secret : data.secrets()) {
                    secrets.put(secret.key(), secretCipher.decrypt(
                            secret.ciphertext(), secret.nonce(), secret.keyVersion()
                    ));
                }
                return new RuntimeBootstrapResponse.RuntimeFeature(
                        feature.installationId(), feature.code(), feature.version(),
                        feature.runtimeKey(), feature.revision(),
                        data.config(),
                        secrets,
                        data.presentations(),
                        feature.state()
                );
            }).toList();
            return new RuntimeBootstrapResponse.RuntimeBot(
                    bot.id(), bot.name(), bot.applicationId(), bot.guildId(),
                    secretCipher.decrypt(bot.ciphertext(), bot.nonce(), bot.keyVersion()),
                    bot.restartRevision(),
                    new RuntimeBootstrapResponse.RuntimeSubscription(
                            bot.runtimeSubscriptionId(), bot.currentPeriodEnd(), bot.autoRenew()
                    ),
                    features
            );
        }).toList();
        long revision = bots.stream().mapToLong(bot -> bot.restartRevision()
                + bot.features().stream()
                .mapToLong(RuntimeBootstrapResponse.RuntimeFeature::configRevision)
                .sum()).sum();
        return new RuntimeBootstrapResponse(revision, bots);
    }

    // Called under bootstrap's lock. Runtime eligibility and state are still read
    // on every snapshot refresh; only large revisioned feature data is reused.
    private Map<UUID, CachedFeatureData> loadFeatureData(List<RuntimeRepository.FeatureRow> features) {
        long now = System.nanoTime();
        Map<UUID, Long> revisions = new LinkedHashMap<>();
        for (var feature : features) revisions.put(feature.configSetId(), feature.revision());
        List<UUID> reload = revisions.entrySet().stream().filter(entry -> {
            var cached = featureDataCache.get(entry.getKey());
            return cached == null || cached.revision() != entry.getValue()
                    || now - cached.loadedAtNanos() >= featureDataTtlNanos;
        }).map(Map.Entry::getKey).toList();
        meters.summary("runtime.bootstrap.config.reloads").record(reload.size());
        var configs = reload.isEmpty() ? Map.<UUID, Map<String, tools.jackson.databind.JsonNode>>of()
                : repository.findConfig(reload);
        var presentations = reload.isEmpty() ? Map.<UUID, Map<String, tools.jackson.databind.JsonNode>>of()
                : repository.findPresentations(reload);
        Map<UUID, List<RuntimeRepository.SecretRow>> secrets = new LinkedHashMap<>();
        if (!reload.isEmpty()) {
            for (var secret : repository.findSecrets(reload)) {
                secrets.computeIfAbsent(secret.configSetId(), ignored -> new ArrayList<>()).add(secret);
            }
        }
        var refreshed = new java.util.HashSet<>(reload);
        Map<UUID, CachedFeatureData> active = new LinkedHashMap<>();
        for (var entry : revisions.entrySet()) {
            UUID id = entry.getKey();
            active.put(id, refreshed.contains(id)
                    ? new CachedFeatureData(entry.getValue(), now, configs.getOrDefault(id, Map.of()),
                            secrets.getOrDefault(id, List.of()), presentations.getOrDefault(id, Map.of()))
                    : featureDataCache.get(id));
        }
        // Drop removed installations instead of retaining configurations forever.
        featureDataCache = active;
        return active;
    }

    private record CachedFeatureData(long revision, long loadedAtNanos,
            Map<String, tools.jackson.databind.JsonNode> config,
            List<RuntimeRepository.SecretRow> secrets,
            Map<String, tools.jackson.databind.JsonNode> presentations) {}

    private String etag(RuntimeBootstrapResponse response) {
        try {
            byte[] content = objectMapper.writeValueAsString(response).getBytes(StandardCharsets.UTF_8);
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (tools.jackson.core.JacksonException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Unable to fingerprint runtime bootstrap", exception);
        }
    }

    @Transactional
    public void updateStatus(RuntimeStatusRequest request) {
        var allowed = request.installationId() == null
                ? java.util.Set.of("RUNNING", "STOPPED", "CRASHED")
                : java.util.Set.of("INSTALLING", "ACTIVE", "DISABLED", "ERROR");
        if (!allowed.contains(request.status())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid runtime status");
        }
        repository.updateStatus(request);
        if (request.installationId() != null && java.util.Set.of("DISABLED", "ERROR").contains(request.status())) {
            invalidateSnapshot();
        }
    }

    @Transactional
    public void updateState(RuntimeStateRequest request) {
        if (!request.state().isObject()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Runtime state must be a JSON object");
        }
        if (request.state().toString().length() > 16_384) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Runtime state is too large");
        }
        if (!repository.upsertState(request)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Active feature installation not found");
        }
        invalidateSnapshot();
    }

    private void invalidateSnapshot() {
        cachedBootstrap = null;
    }

    public synchronized void invalidateBootstrap() {
        cachedBootstrap = null;
        featureDataCache = Map.of();
    }

    public record CachedBootstrap(RuntimeBootstrapResponse response, String etag, long createdAtNanos) {
    }
}
