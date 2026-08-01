package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record FeatureConfigurationResponse(
        UUID licenseId,
        long revision,
        UUID validatedForBotId,
        List<FieldResponse> fields,
        List<PresentationResponse> presentations
) {
    public record FieldResponse(
            String key,
            String label,
            String description,
            String type,
            boolean required,
            boolean secret,
            JsonNode defaultValue,
            JsonNode value,
            boolean configured,
            JsonNode validation,
            JsonNode ui
    ) {
    }

    public record PresentationResponse(
            UUID slotId,
            String key,
            String label,
            String type,
            List<String> availableVariables,
            JsonNode defaultDefinition,
            JsonNode overrideDefinition
    ) {
    }
}
