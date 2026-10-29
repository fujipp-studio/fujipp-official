package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class TicketConfigurationValidator {
    private TicketConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
        JsonNode history = values.get("TICKET_DISCORD_HISTORY_ENABLED");
        if (history != null && !history.isBoolean()) fail("Ticket Discord history setting must be boolean");
        JsonNode command = values.get("TICKET_COMMAND_NAME");
        if (command != null && !key(command)) fail("Ticket command must use 1–32 lowercase letters, numbers, _ or -");
        JsonNode categories = values.get("TICKET_CATEGORIES");
        if (categories == null) return;
        if (!categories.isArray() || categories.isEmpty() || categories.size() > 25)
            fail("Configure 1–25 ticket categories");
        var keys = new HashSet<String>();
        for (JsonNode row : categories) {
            if (!row.isObject() || !key(row.path("key")) || !keys.add(row.path("key").asText())
                    || !text(row.path("label"), 100, false) || !text(row.path("description"), 100, true)
                    || !id(row.path("categoryId"))) fail("Ticket categories require a unique key, label and Discord category ID");
            JsonNode roles = row.path("supportRoleIds");
            if (!roles.isArray() || roles.size() > 10) fail("Configure at most 10 support roles per ticket category");
            var roleIds = new HashSet<String>();
            for (JsonNode role : roles)
                if (!id(role) || !roleIds.add(role.asText())) fail("Support role IDs must be valid and unique");
            JsonNode minutes = row.path("autoCloseMinutes");
            if (!minutes.isIntegralNumber() || !minutes.canConvertToInt() || minutes.asInt() < 0 || minutes.asInt() > 43200
                    || !Set.of("IDLE", "OPENED").contains(row.path("autoCloseMode").asText()))
                fail("Ticket auto-close must be 0–43200 minutes, using IDLE or OPENED mode");
            if (!row.path("formEnabled").isBoolean() || !text(row.path("formTitle"), 45, false))
                fail("Ticket forms require a boolean switch and a title of 1–45 characters");
            JsonNode fields = row.path("fields");
            if (!fields.isArray() || fields.size() > 5 || (row.path("formEnabled").asBoolean() && fields.isEmpty()))
                fail("Enabled ticket forms require 1–5 fields");
            var fieldKeys = new HashSet<String>();
            for (JsonNode field : fields) {
                if (!field.isObject() || !key(field.path("key")) || !fieldKeys.add(field.path("key").asText())
                        || !text(field.path("label"), 45, false) || !text(field.path("placeholder"), 100, true)
                        || !field.path("required").isBoolean()
                        || !Set.of("SHORT", "PARAGRAPH").contains(field.path("style").asText()))
                    fail("Ticket form fields require unique keys, labels, input styles and required switches");
            }
        }
    }
    private static boolean key(JsonNode node) { return node.isTextual() && node.asText().matches("[a-z0-9_-]{1,32}"); }
    private static boolean id(JsonNode node) { return node.isTextual() && node.asText().matches("[0-9]{15,30}"); }
    private static boolean text(JsonNode node, int max, boolean empty) {
        return node.isTextual() && node.asText().length() <= max && (empty || !node.asText().isBlank());
    }
    private static void fail(String message) { throw new StoreValidationException(message); }
}
