package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;

final class MessageSetsConfigurationValidator {
    private MessageSetsConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
        JsonNode command = values.get("MESSAGE_SETS_COMMAND_NAME");
        if (command != null && (!command.isTextual() || !command.asText().matches("[a-z0-9_-]{1,32}"))) {
            throw new StoreValidationException("Command name must use 1–32 lowercase letters, numbers, _ or -");
        }
        JsonNode sets = values.get("MESSAGE_SETS");
        if (sets == null) return;
        if (!sets.isArray() || sets.size() > 20) {
            throw new StoreValidationException("A bot can have at most 20 SETs");
        }
        var names = new HashSet<String>();
        var slots = new HashSet<String>();
        for (JsonNode set : sets) {
            JsonNode name = set.get("name");
            JsonNode slot = set.get("presentationSlot");
            if (!set.isObject() || name == null || !name.isTextual()
                    || name.asText().isBlank() || name.asText().length() > 100
                    || !name.asText().equals(name.asText().trim())
                    || slot == null || !slot.isTextual() || !slot.asText().matches("set_(?:[1-9]|1[0-9]|20)")
                    || !names.add(name.asText().toLowerCase(Locale.ROOT)) || !slots.add(slot.asText())) {
                throw new StoreValidationException("SET names and message slots must be valid and unique");
            }
        }
    }
}
