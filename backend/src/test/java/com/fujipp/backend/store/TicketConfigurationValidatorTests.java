package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TicketConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private static final String CATEGORY = """
        {"key":"order","label":"สั่งซื้อ","description":"Order","categoryId":"111111111111111111",
         "supportRoleIds":["222222222222222222"],"autoCloseMinutes":1440,"autoCloseMode":"IDLE",
         "formEnabled":true,"formTitle":"สั่งซื้อ","fields":[
          {"key":"product","label":"สินค้า","style":"SHORT","required":true,"placeholder":""}]}
        """.trim();

    @Test void acceptsFormsAndOptionalFormlessTopics() {
        assertThatCode(() -> TicketConfigurationValidator.validate(Map.of())).doesNotThrowAnyException();
        assertThatCode(() -> TicketConfigurationValidator.validate(Map.of(
            "TICKET_COMMAND_NAME", mapper.valueToTree("support"),
            "TICKET_CATEGORIES", mapper.readTree("[" + CATEGORY + "]")))).doesNotThrowAnyException();
        String noForm = CATEGORY.replace("\"formEnabled\":true", "\"formEnabled\":false")
            .replace("1440", "0").replace("\"IDLE\"", "\"OPENED\"");
        assertThatCode(() -> TicketConfigurationValidator.validate(Map.of(
            "TICKET_CATEGORIES", mapper.readTree("[" + noForm + "]")))).doesNotThrowAnyException();
    }

    @Test void rejectsMalformedTopicsTimersAndFormFields() {
        for (String invalid : new String[]{"{}", "[]", "[null]", "[" + CATEGORY + "," + CATEGORY + "]",
                "[" + CATEGORY.replace("111111111111111111", "invalid") + "]",
                "[" + CATEGORY.replace("1440", "-1") + "]",
                "[" + CATEGORY.replace("1440", "0.5") + "]",
                "[" + CATEGORY.replace("1440", "43201") + "]",
                "[" + CATEGORY.replace("\"IDLE\"", "\"UNKNOWN\"") + "]",
                "[" + CATEGORY.replace("\"formEnabled\":true", "\"formEnabled\":\"true\"") + "]",
                "[" + CATEGORY.replace("\"label\":\"สินค้า\"", "\"label\":\" \"") + "]",
                "[" + CATEGORY.replace("\"SHORT\"", "\"NUMBER\"") + "]",
                "[" + CATEGORY.replace("\"required\":true", "\"required\":null") + "]",
                "[" + CATEGORY.replace("\"222222222222222222\"", "\"222222222222222222\",\"222222222222222222\"") + "]"}) {
            assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of(
                "TICKET_CATEGORIES", mapper.readTree(invalid)))).isInstanceOf(StoreValidationException.class);
        }
    }

    @Test void enforcesFieldAndCategoryLimitsAndUniqueFieldKeys() {
        var row = mapper.readTree(CATEGORY).deepCopy();
        var rows = mapper.createArrayNode();
        for (int i = 0; i < 26; i++) rows.add(row);
        assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES", rows)))
            .isInstanceOf(StoreValidationException.class);
        var fields = (tools.jackson.databind.node.ArrayNode) row.path("fields");
        fields.add(fields.get(0).deepCopy());
        assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES", mapper.createArrayNode().add(row))))
            .isInstanceOf(StoreValidationException.class);
        fields.removeAll();
        assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES", mapper.createArrayNode().add(row))))
            .isInstanceOf(StoreValidationException.class);
    }

    @Test void rejectsInvalidCommandNames() {
        for (String name : new String[]{"", "/ticket", "Ticket", "ticket panel", "x".repeat(33)})
            assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of(
                "TICKET_COMMAND_NAME", mapper.valueToTree(name)))).isInstanceOf(StoreValidationException.class);
    }
    @Test void validatesOptionalPerTopicPingSwitchesAndRecipients() {
        var category = (tools.jackson.databind.node.ObjectNode) mapper.readTree(CATEGORY);
        var rows = mapper.createArrayNode().add(category);
        for (String raw : java.util.List.of(
                "{\"enabled\":true,\"opener\":true,\"roleIds\":[\"222222222222222222\"],\"userIds\":[\"333333333333333333\"]}",
                "{\"enabled\":false,\"opener\":false,\"roleIds\":[],\"userIds\":[]}")) {
            category.set("openingMentions", mapper.readTree(raw));
            assertThatCode(() -> TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES", rows))).doesNotThrowAnyException();
        }
        for (String raw : java.util.List.of("null", "{}", "{\"enabled\":\"true\",\"opener\":true,\"roleIds\":[],\"userIds\":[]}",
                "{\"enabled\":true,\"opener\":null,\"roleIds\":[],\"userIds\":[]}",
                "{\"enabled\":false,\"opener\":true,\"roleIds\":[\"bad\"],\"userIds\":[]}",
                "{\"enabled\":true,\"opener\":true,\"roleIds\":[],\"userIds\":[\"333333333333333333\",\"333333333333333333\"]}")) {
            category.set("openingMentions", mapper.readTree(raw));
            assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES", rows))).isInstanceOf(StoreValidationException.class);
        }
        for (String key : java.util.List.of("roleIds", "userIds")) {
            var mentions = mapper.createObjectNode().put("enabled", true).put("opener", false);
            mentions.set("roleIds", mapper.createArrayNode()); mentions.set("userIds", mapper.createArrayNode());
            var ids = mapper.createArrayNode();
            for (int i = 0; i < (key.equals("roleIds") ? 11 : 26); i++) ids.add(Long.toString(222222222222222222L + i));
            mentions.set(key, ids); category.set("openingMentions", mentions);
            assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES", rows))).isInstanceOf(StoreValidationException.class);
        }
    }
    @Test void discordHistoryIsAnExplicitBooleanOption() {
        for (boolean enabled : new boolean[]{true, false})
            assertThatCode(() -> TicketConfigurationValidator.validate(Map.of("TICKET_DISCORD_HISTORY_ENABLED", mapper.valueToTree(enabled)))).doesNotThrowAnyException();
        for (Object value : new Object[]{"true", 1, java.util.List.of()})
            assertThatThrownBy(() -> TicketConfigurationValidator.validate(Map.of("TICKET_DISCORD_HISTORY_ENABLED", mapper.valueToTree(value))))
                .isInstanceOf(StoreValidationException.class);
    }
    @Test void validatesOpeningLimitsConfirmationAndClosingPermissions() {
        var behavior=mapper.readTree("{\"maxOpenPerUser\":1,\"confirmClose\":true,\"closeRoleIds\":[],\"closeUserIds\":[]}");
        assertThatCode(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).doesNotThrowAnyException();
        for(String invalid: new String[]{"{}","{\"maxOpenPerUser\":0,\"confirmClose\":true,\"closeRoleIds\":[],\"closeUserIds\":[]}",
                "{\"maxOpenPerUser\":26,\"confirmClose\":true,\"closeRoleIds\":[],\"closeUserIds\":[]}",
                "{\"maxOpenPerUser\":1,\"confirmClose\":true,\"closeRoleIds\":[\"bad\"],\"closeUserIds\":[]}"})
            assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",mapper.readTree(invalid)))).isInstanceOf(StoreValidationException.class);
    }
    @Test void supportsCustomEmojiAndDocumentedChannelNameVariables() {
        var category=(tools.jackson.databind.node.ObjectNode)mapper.readTree(CATEGORY);
        category.put("emoji","<a:cart:123456789012345678>").put("channelNameTemplate","order-{{username}}-{{id}}");
        assertThatCode(()->TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES",mapper.createArrayNode().add(category)))).doesNotThrowAnyException();
        category.put("channelNameTemplate","{{unknown}}");
        assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES",mapper.createArrayNode().add(category)))).isInstanceOf(StoreValidationException.class);
        category.put("channelNameTemplate","ticket").put("emoji","<script>");
        assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES",mapper.createArrayNode().add(category)))).isInstanceOf(StoreValidationException.class);
    }
    @Test void validatesPerTopicWelcomeWithoutOverwritingTheSharedDesign() {
        var category=(tools.jackson.databind.node.ObjectNode)mapper.readTree(CATEGORY);
        category.set("welcome",mapper.readTree("{\"title\":\"Purchase {{id}}\",\"description\":\"Hello {{user}}\",\"imageUrl\":\"https://example.com/image.gif\"}"));
        assertThatCode(()->TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES",mapper.createArrayNode().add(category)))).doesNotThrowAnyException();
        ((tools.jackson.databind.node.ObjectNode)category.path("welcome")).put("imageUrl","javascript:alert(1)");
        assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_CATEGORIES",mapper.createArrayNode().add(category)))).isInstanceOf(StoreValidationException.class);
    }
    @Test void supportsIndependentCommandButtonOptionsAndRejectsInvalidModes() {
        var behavior=(tools.jackson.databind.node.ObjectNode)mapper.readTree("{\"maxOpenPerUser\":1,\"confirmClose\":true,\"closeRoleIds\":[],\"closeUserIds\":[]}");
        behavior.put("controlStyle","DIRECT");
        behavior.set("actions",mapper.readTree("{\"close\":\"BUTTON\",\"schedule\":\"COMMAND\",\"autoClose\":\"COMMAND\",\"addUser\":\"BOTH\",\"history\":\"OFF\"}"));
        assertThatCode(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).doesNotThrowAnyException();
        for(String raw:java.util.List.of("null","[]","{\"close\":null}","{\"close\":[\"BOTH\"]}","{\"close\":\"INVALID\"}","{\"unknown\":\"OFF\"}")) {
            behavior.set("actions",mapper.readTree(raw));
            assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).isInstanceOf(StoreValidationException.class);
        }
        behavior.remove("actions");
        behavior.put("controlStyle","INVALID");
        assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).isInstanceOf(StoreValidationException.class);
    }

    @Test void cancellationMessagesAreOptionalAndRespectTheDiscordTextLimit() {
        var behavior=(tools.jackson.databind.node.ObjectNode)mapper.readTree("{\"maxOpenPerUser\":1,\"confirmClose\":true,\"closeRoleIds\":[],\"closeUserIds\":[]}");
        for(String raw:java.util.List.of("{\"enabled\":true,\"message\":\"**Open**\"}","{\"enabled\":false,\"message\":\"\"}")) {
            behavior.set("cancellationNotice",mapper.readTree(raw));
            assertThatCode(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).doesNotThrowAnyException();
        }
        for(String raw:java.util.List.of("null","{}","{\"enabled\":\"true\",\"message\":\"Hello\"}","{\"enabled\":true,\"message\":\" \"}","{\"enabled\":false,\"message\":null}")) {
            behavior.set("cancellationNotice",mapper.readTree(raw));
            assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).isInstanceOf(StoreValidationException.class);
        }
        behavior.set("cancellationNotice",mapper.createObjectNode().put("enabled",true).put("message","a".repeat(2001)));
        assertThatThrownBy(()->TicketConfigurationValidator.validate(Map.of("TICKET_BEHAVIOR",behavior))).isInstanceOf(StoreValidationException.class);
    }

}
