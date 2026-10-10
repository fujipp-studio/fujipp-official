package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PresentationConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void rejectsMissingEmptyAndOversizedRowsAtRootAndInsideContainers() throws Exception {
        for (String children : new String[]{"null", "[]", "[{}, {}, {}, {}, {}, {}]"}) {
            String row = "{\"type\":1,\"components\":" + children + "}";
            var root = mapper.readTree("{\"mode\":\"COMPONENTS_V2\",\"components\":[{\"type\":10}," + row + "]}");
            assertThatThrownBy(() -> PresentationConfigurationValidator.validate(Map.of("set_1", root)))
                    .isInstanceOf(StoreValidationException.class).hasMessageContaining("set_1: components[1].components");
            var nested = mapper.readTree("{\"mode\":\"COMPONENTS_V2\",\"components_v2\":{\"components\":[{\"type\":17,\"components\":[" + row + "]}]}}");
            assertThatThrownBy(() -> PresentationConfigurationValidator.validate(Map.of("set_2", nested)))
                    .isInstanceOf(StoreValidationException.class).hasMessageContaining("set_2: components[0].components[0].components");
        }
    }

    @Test void acceptsBoundaryButtonCountsAndSingleSelects() throws Exception {
        for (int count : new int[]{1, 5}) {
            var row = mapper.createObjectNode().put("type", 1);
            var buttons = row.putArray("components");
            for (int i = 0; i < count; i++) buttons.addObject().put("type", 2);
            var definition = mapper.createObjectNode().put("mode", "COMPONENTS_V2");
            var container = definition.putObject("components_v2").putArray("components").addObject().put("type", 17);
            container.putArray("components").add(row).add(mapper.readTree("{\"type\":1,\"components\":[{\"type\":3}]}"));
            assertThatCode(() -> PresentationConfigurationValidator.validate(Map.of("set_1", definition))).doesNotThrowAnyException();
        }
    }

    @Test void ignoresInactiveComponentsLayoutOnEmbedMessages() throws Exception {
        var definition = mapper.readTree("{\"mode\":\"EMBED\",\"components_v2\":{\"components\":[{\"type\":1,\"components\":[]}]}}");
        assertThatCode(() -> PresentationConfigurationValidator.validate(Map.of("set_1", definition))).doesNotThrowAnyException();
    }
}
