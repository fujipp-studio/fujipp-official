package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreSecretCipher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;

@Service
public class RuntimeService {

    private final RuntimeRepository repository;
    private final StoreSecretCipher secretCipher;
    private final tools.jackson.databind.ObjectMapper objectMapper;
    private final long snapshotTtlNanos;
    private volatile CachedBootstrap cachedBootstrap;

    public RuntimeService(
            RuntimeRepository repository,
            StoreSecretCipher secretCipher,
            tools.jackson.databind.ObjectMapper objectMapper,
            @Value("${app.runtime.bootstrap-cache-ttl:60s}") Duration snapshotTtl
    ) {
        this.repository = repository;
        this.secretCipher = secretCipher;
        this.objectMapper = objectMapper;
        this.snapshotTtlNanos = snapshotTtl.toNanos();
    }

    @Transactional(readOnly = true)
    public CachedBootstrap bootstrap() {
        long now = System.nanoTime();
        CachedBootstrap current = cachedBootstrap;
        if (current != null && now - current.createdAtNanos() < snapshotTtlNanos) {
            return current;
        }
        synchronized (this) {
            current = cachedBootstrap;
            if (current != null && now - current.createdAtNanos() < snapshotTtlNanos) {
                return current;
            }
            RuntimeBootstrapResponse response = loadBootstrap();
            current = new CachedBootstrap(response, etag(response), now);
            cachedBootstrap = current;
            return current;
        }
    }

    private RuntimeBootstrapResponse loadBootstrap() {
        var bots = repository.findRunnableBots().stream().map(bot -> {
            var features = repository.findFeatures(bot.id()).stream().map(feature -> {
                var secrets = new LinkedHashMap<String, String>();
                for (var secret : repository.findSecrets(feature.configSetId())) {
                    secrets.put(secret.key(), secretCipher.decrypt(
                            secret.ciphertext(), secret.nonce(), secret.keyVersion()
                    ));
                }
                return new RuntimeBootstrapResponse.RuntimeFeature(
                        feature.installationId(), feature.code(), feature.version(),
                        feature.runtimeKey(), feature.revision(),
                        repository.findConfig(feature.configSetId()),
                        secrets,
                        repository.findPresentations(feature.configSetId()),
                        repository.findState(feature.installationId())
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
        cachedBootstrap = null;
    }

    public record CachedBootstrap(RuntimeBootstrapResponse response, String etag, long createdAtNanos) {
    }
}
