package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.JsonNode;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ShopStatusConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void acceptsCustomNamesAndOptionalPermissions() {
        assertThatCode(() -> ShopStatusConfigurationValidator.validate(Map.of())).doesNotThrowAnyException();
        assertThatCode(() -> ShopStatusConfigurationValidator.validate(Map.of(
            "SHOP_OPEN_DELIVERY_MODE", mapper.valueToTree("UPDATE"),
            "SHOP_CLOSE_DELIVERY_MODE", mapper.valueToTree("REPLACE"),
            "SHOP_COMMAND_NAME", mapper.valueToTree("store"),
            "SHOP_OPEN_COMMAND", mapper.valueToTree("start"),
            "SHOP_CLOSE_COMMAND", mapper.valueToTree("stop"),
            "SHOP_PERMISSION_RULES", mapper.readTree("""
                [{"channelId":"111111111111111111","roleId":"222222222222222222",
                  "open":{"ViewChannel":"ALLOW","Connect":"INHERIT"},
                  "close":{"ViewChannel":"DENY","SendMessages":"KEEP"}}]
                """)))).doesNotThrowAnyException();
    }
    @Test void validatesOptionalChannelNames() {
        for (String state : new String[]{"OPEN", "CLOSE"}) {
            for (String name : new String[]{"", "🔴・สถานะ・ร้านปิด", "x".repeat(100)})
                assertThatCode(() -> ShopStatusConfigurationValidator.validate(Map.of(
                    "SHOP_" + state + "_CHANNEL_NAME", mapper.valueToTree(name)))).doesNotThrowAnyException();
            for (Object name : new Object[]{123, java.util.List.of(), " ", "x".repeat(101), "open\nshop", "open\tshop"})
                assertThatThrownBy(() -> ShopStatusConfigurationValidator.validate(Map.of(
                    "SHOP_" + state + "_CHANNEL_NAME", mapper.valueToTree(name))))
                    .isInstanceOf(StoreValidationException.class);
        }
    }
    @Test void rejectsInvalidNamesAndMatchingSubcommands() {
        for (String name : new String[]{"", "/shop", "SHOP", "shop open", "a".repeat(33)})
            assertThatThrownBy(() -> ShopStatusConfigurationValidator.validate(Map.of("SHOP_COMMAND_NAME", mapper.valueToTree(name))))
                .isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(() -> ShopStatusConfigurationValidator.validate(Map.of("SHOP_OPEN_COMMAND", mapper.valueToTree("close"))))
            .isInstanceOf(StoreValidationException.class);
    }
    @Test void rejectsUnknownPermissionsInvalidIdsDuplicatesAndOversizedRules() {
        String rule = """
            {"channelId":"111111111111111111","roleId":"222222222222222222","open":{},"close":{}}
            """.trim();
        for (String json : new String[]{"{}", "[null]", "[{}]", "[" + rule + "," + rule + "]",
                "[" + rule.replace("111111111111111111", "invalid") + "]",
                "[" + rule.replace("\"open\":{}", "\"open\":{\"Administrator\":\"ALLOW\"}") + "]",
                "[" + rule.replace("\"close\":{}", "\"close\":{\"ViewChannel\":\"typo\"}") + "]",
                "[" + rule.replace("\"open\":{}", "\"open\":[]") + "]"}) {
            assertThatThrownBy(() -> ShopStatusConfigurationValidator.validate(Map.of("SHOP_PERMISSION_RULES", mapper.readTree(json))))
                .isInstanceOf(StoreValidationException.class);
        }
        var rules = mapper.createArrayNode();
        for (int i = 0; i < 26; i++) rules.add(mapper.readTree(rule));
        assertThatThrownBy(() -> ShopStatusConfigurationValidator.validate(Map.of("SHOP_PERMISSION_RULES", rules)))
            .isInstanceOf(StoreValidationException.class);
    }
    @Test void rejectsInvalidAnnouncementTypesTextAndChannel() {
        for (Map<String, JsonNode> values : java.util.List.<Map<String, JsonNode>>of(
                Map.of("SHOP_OPEN_DELIVERY_MODE", mapper.valueToTree("invalid")),
                Map.of("SHOP_CLOSE_DELIVERY_MODE", mapper.readTree("[\"UPDATE\"]")),
                Map.of("SHOP_OPEN_MESSAGE_TYPE", mapper.valueToTree("HTML")),
                Map.of("SHOP_OPEN_MESSAGE_TYPE", mapper.valueToTree("TEXT"), "SHOP_OPEN_TEXT", mapper.valueToTree(" ")),
                Map.of("SHOP_CLOSE_TEXT", mapper.valueToTree("x".repeat(2001))),
                Map.of("SHOP_ANNOUNCEMENT_CHANNEL_ID", mapper.valueToTree("invalid")))) {
            assertThatThrownBy(() -> ShopStatusConfigurationValidator.validate(values)).isInstanceOf(StoreValidationException.class);
        }
    }
}
