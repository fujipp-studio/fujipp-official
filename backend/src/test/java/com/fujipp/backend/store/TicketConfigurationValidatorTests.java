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
}
