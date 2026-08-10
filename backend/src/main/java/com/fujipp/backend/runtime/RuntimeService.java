package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreSecretCipher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;

@Service
public class RuntimeService {

    private final RuntimeRepository repository;
    private final StoreSecretCipher secretCipher;

    public RuntimeService(RuntimeRepository repository, StoreSecretCipher secretCipher) {
        this.repository = repository;
        this.secretCipher = secretCipher;
    }

    @Transactional(readOnly = true)
    public RuntimeBootstrapResponse bootstrap() {
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
    }
}
