package com.fujipp.backend.store;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.util.Map;

public record UpdateFeatureConfigurationRequest(
        @NotNull @Size(max = 100) Map<String, JsonNode> values,
        @NotNull @Size(max = 30) Map<String, @Size(max = 10000) String> secrets,
        @NotNull @Size(max = 100) Map<String, JsonNode> presentations
) {
}
