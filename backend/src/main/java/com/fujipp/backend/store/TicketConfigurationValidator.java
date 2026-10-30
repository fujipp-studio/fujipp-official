package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class TicketConfigurationValidator {
    private TicketConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
        JsonNode behavior = values.get("TICKET_BEHAVIOR");
        if (behavior != null) {
            JsonNode limit = behavior.path("maxOpenPerUser");
            if (!behavior.isObject() || !limit.isIntegralNumber() || !limit.canConvertToInt() || limit.asInt() < 1 || limit.asInt() > 25
                    || !behavior.path("confirmClose").isBoolean()) fail("Ticket limit must be 1–25 with a boolean close confirmation setting");
            ids(behavior.path("closeRoleIds"), 10);
            ids(behavior.path("closeUserIds"), 25);
            if (behavior.has("controlStyle") && (!behavior.path("controlStyle").isTextual() || !Set.of("MANAGE","DIRECT").contains(behavior.path("controlStyle").asText()))) fail("Invalid Ticket control style");
            if (behavior.has("actions")) {
                JsonNode actions = behavior.path("actions");
                if (!actions.isObject()) fail("Ticket actions must be an object");
                for (var property : actions.properties()) {
                    if (!Set.of("close","schedule","autoClose","addUser","history").contains(property.getKey()) || !property.getValue().isTextual()
                            || !Set.of("OFF","COMMAND","BUTTON","BOTH").contains(property.getValue().asText())) fail("Invalid Ticket command/button option");
                }
            }
        }
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
            if(row.has("welcome")) {
                JsonNode welcome=row.path("welcome");
                if(!welcome.isObject() || !text(welcome.path("title"),256,false) || !text(welcome.path("description"),3500,true)
                    || !text(welcome.path("imageUrl"),2048,true) || (!welcome.path("imageUrl").asText().isEmpty() && !welcome.path("imageUrl").asText().matches("https://[^\\s]+")))
                    fail("Topic welcome requires a title, description and optional HTTPS image URL");
            }
            if (row.has("emoji")) {
                String emoji = row.path("emoji").asText();
                if (!row.path("emoji").isTextual() || emoji.length() > 100 || (!emoji.isEmpty()
                        && !emoji.matches("<a?:[A-Za-z0-9_]{2,32}:[0-9]{15,30}>")
                        && !(emoji.length() <= 32 && emoji.codePoints().anyMatch(c -> c >= 0x1F000 || (c >= 0x2000 && c <= 0x32FF)) && !emoji.matches("(?s).*[<>\\r\\n].*"))))
                    fail("Use a Unicode emoji or a Discord custom emoji such as <:name:123456789012345678>");
            }
            if (row.has("channelNameTemplate")) {
                String template = row.path("channelNameTemplate").asText();
                if (!text(row.path("channelNameTemplate"),100,false) || template.matches("(?s).*[\\p{Cc}\\p{Cf}/\\\\].*")
                        || template.replaceAll("\\{\\{(username|user_id|topic|id)\\}\\}", "").matches("(?s).*[{}].*"))
                    fail("Ticket names support {{username}}, {{user_id}}, {{topic}} and {{id}}");
            }
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
    private static void ids(JsonNode values, int max) {
        var unique = new HashSet<String>();
        if (!values.isArray() || values.size() > max) fail("Invalid Ticket closing role/user list");
        for (JsonNode value : values) if (!id(value) || !unique.add(value.asText())) fail("Ticket closing IDs must be valid and unique");
    }
    private static boolean id(JsonNode node) { return node.isTextual() && node.asText().matches("[0-9]{15,30}"); }
    private static boolean text(JsonNode node, int max, boolean empty) {
        return node.isTextual() && node.asText().length() <= max && (empty || !node.asText().isBlank());
    }
    private static void fail(String message) { throw new StoreValidationException(message); }
}
