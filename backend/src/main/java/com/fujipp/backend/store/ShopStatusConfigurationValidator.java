package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class ShopStatusConfigurationValidator {
    private static final Set<String> PERMISSIONS = Set.of("ViewChannel", "SendMessages", "Connect");
    private static final Set<String> SETTINGS = Set.of("ALLOW", "DENY", "INHERIT", "KEEP");
    private ShopStatusConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
        String open = command(values, "SHOP_OPEN_COMMAND", "open");
        String close = command(values, "SHOP_CLOSE_COMMAND", "close");
        command(values, "SHOP_COMMAND_NAME", "shop");
        if (open.equals(close)) fail("Open and close subcommands must be different");
        JsonNode channel = values.get("SHOP_ANNOUNCEMENT_CHANNEL_ID");
        if (channel != null && (!channel.isTextual() || !channel.asText().matches("(?:[0-9]{15,30})?")))
            fail("Invalid shop announcement channel ID");
        for (String state : new String[]{"OPEN", "CLOSE"}) {
            JsonNode delivery = values.get("SHOP_" + state + "_DELIVERY_MODE");
            if (delivery != null && (!delivery.isTextual() || !Set.of("NEW", "UPDATE", "REPLACE").contains(delivery.asText())))
                fail("Invalid shop delivery mode");
            JsonNode mode = values.get("SHOP_" + state + "_MESSAGE_TYPE");
            if (mode != null && (!mode.isTextual() || !Set.of("TEXT", "DESIGNED").contains(mode.asText())))
                fail("Invalid shop message type");
            JsonNode text = values.get("SHOP_" + state + "_TEXT");
            if (text != null && (!text.isTextual() || text.asText().length() > 2000
                    || (mode != null && "TEXT".equals(mode.asText()) && text.asText().isBlank())))
                fail("Shop text must contain 1–2000 characters when plain text is selected");
        }
        JsonNode rules = values.get("SHOP_PERMISSION_RULES");
        if (rules == null) return;
        if (!rules.isArray() || rules.size() > 25) fail("At most 25 shop permission rules are allowed");
        var pairs = new HashSet<String>();
        for (JsonNode rule : rules) {
            if (!rule.isObject() || !id(rule.path("channelId")) || !id(rule.path("roleId")))
                fail("Shop rules require valid channel and role IDs");
            if (!pairs.add(rule.path("channelId").asText() + "/" + rule.path("roleId").asText()))
                fail("Duplicate channel and role rule");
            for (String state : new String[]{"open", "close"}) {
                JsonNode settings = rule.path(state);
                if (!settings.isObject()) fail("Shop rules require open and close permission settings");
                for (var entry : settings.properties()) {
                    if (!PERMISSIONS.contains(entry.getKey()) || !entry.getValue().isTextual()
                            || !SETTINGS.contains(entry.getValue().asText())) fail("Invalid shop permission setting");
                }
            }
        }
    }

    private static String command(Map<String, JsonNode> values, String key, String fallback) {
        JsonNode value = values.get(key);
        if (value == null) return fallback;
        if (!value.isTextual() || !value.asText().matches("[a-z0-9_-]{1,32}"))
            fail("Shop command names must use 1–32 lowercase letters, numbers, _ or -");
        return value.asText();
    }

    private static boolean id(JsonNode node) { return node.isTextual() && node.asText().matches("[0-9]{15,30}"); }
    private static void fail(String message) { throw new StoreValidationException(message); }
}
