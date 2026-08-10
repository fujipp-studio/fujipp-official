package com.fujipp.backend.runtime;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

public record RuntimeStateRequest(
        @NotNull UUID botId,
        @NotNull UUID installationId,
        @NotNull JsonNode state
) {
}
