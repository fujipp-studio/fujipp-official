package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;

import java.util.Map;

final class PresentationConfigurationValidator {
    private PresentationConfigurationValidator() {}

    static void validate(Map<String, JsonNode> presentations) {
        presentations.forEach((slot, definition) -> {
            if (definition == null || !definition.isObject()) {
                throw new StoreValidationException("Presentation definitions must be JSON objects: " + slot);
            }
            if (!"COMPONENTS_V2".equalsIgnoreCase(definition.path("mode").asText("EMBED"))) return;
            JsonNode nested = definition.path("components_v2");
            JsonNode source = nested.isObject() ? nested : definition;
            validateRows(source.path("components"), slot + ": components");
        });
    }

    private static void validateRows(JsonNode components, String path) {
        if (!components.isArray()) return;
        for (int index = 0; index < components.size(); index++) {
            JsonNode component = components.get(index);
            String childPath = path + "[" + index + "].components";
            JsonNode children = component.path("components");
            if (component.path("type").asInt() == 1
                    && (!children.isArray() || children.size() < 1 || children.size() > 5)) {
                throw new StoreValidationException(childPath + " must contain 1–5 buttons. Remove an empty row or split extra buttons into another row.");
            }
            validateRows(children, childPath);
        }
    }
}
