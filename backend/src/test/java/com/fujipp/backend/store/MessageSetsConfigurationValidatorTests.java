package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MessageSetsConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void acceptsEmptyAndTwentyNamedSets() {
        var sets = mapper.createArrayNode();
        assertThatCode(() -> MessageSetsConfigurationValidator.validate(Map.of("MESSAGE_SETS", sets))).doesNotThrowAnyException();
        for (int i = 1; i <= 20; i++) sets.addObject().put("name", "SET " + i).put("presentationSlot", "set_" + i);
        assertThatCode(() -> MessageSetsConfigurationValidator.validate(Map.of("MESSAGE_SETS", sets, "MESSAGE_SETS_COMMAND_NAME", mapper.valueToTree("menu")))).doesNotThrowAnyException();
        sets.addObject().put("name", "SET 21").put("presentationSlot", "set_21");
        assertThatThrownBy(() -> MessageSetsConfigurationValidator.validate(Map.of("MESSAGE_SETS", sets))).isInstanceOf(StoreValidationException.class);
    }
    @Test void rejectsDuplicateNamesSlotsAndInvalidShapes() {
        for (String json : new String[]{"{}", "[null]", "[{\"name\":\"\",\"presentationSlot\":\"set_1\"}]", "[{\"name\":\"Rules\",\"presentationSlot\":\"set_1\"},{\"name\":\"rules\",\"presentationSlot\":\"set_2\"}]", "[{\"name\":\"A\",\"presentationSlot\":\"set_1\"},{\"name\":\"B\",\"presentationSlot\":\"set_1\"}]", "[{\"name\":\"A\",\"presentationSlot\":\"set_21\"}]"}) {
            assertThatThrownBy(() -> MessageSetsConfigurationValidator.validate(Map.of("MESSAGE_SETS", mapper.readTree(json)))).isInstanceOf(StoreValidationException.class);
        }
    }
    @Test void rejectsInvalidCommandNames() {
        for (String name : new String[]{"", "/ec", "EC", "ec hello"})
            assertThatThrownBy(() -> MessageSetsConfigurationValidator.validate(Map.of("MESSAGE_SETS_COMMAND_NAME", mapper.valueToTree(name)))).isInstanceOf(StoreValidationException.class);
    }
}
