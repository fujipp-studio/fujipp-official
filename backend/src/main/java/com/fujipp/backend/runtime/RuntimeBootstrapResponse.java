package com.fujipp.backend.runtime;

import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.time.OffsetDateTime;

public record RuntimeBootstrapResponse(long revision, List<RuntimeBot> bots) {

    public record RuntimeBot(
            UUID id,
            String name,
            String discordApplicationId,
            String discordGuildId,
            String discordToken,
            long restartRevision,
            RuntimeSubscription runtimeSubscription,
            List<RuntimeFeature> features
    ) {
    }

    public record RuntimeSubscription(UUID id, OffsetDateTime currentPeriodEnd, boolean autoRenew) {
    }

    public record RuntimeFeature(
            UUID installationId,
            String code,
            String version,
            String runtimeKey,
            long configRevision,
            Map<String, JsonNode> config,
            Map<String, String> secrets,
            Map<String, JsonNode> presentations,
            Map<String, JsonNode> runtimeState
    ) {
    }
}
