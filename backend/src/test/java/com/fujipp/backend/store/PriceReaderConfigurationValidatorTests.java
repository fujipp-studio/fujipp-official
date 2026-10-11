package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PriceReaderConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void acceptsLegacyDraftsExactMatchesAndEmptyBlockLists() {
        assertThatCode(() -> PriceReaderConfigurationValidator.validate(Map.of())).doesNotThrowAnyException();
        assertThatCode(() -> PriceReaderConfigurationValidator.validate(Map.of(
                "PRICE_READER_MATCH_TOLERANCE_SATANG", mapper.valueToTree(0),
                "PRICE_READER_RESULT_BLOCKS", mapper.createArrayNode(),
                "PRICE_READER_RESULTS_SEPARATOR", mapper.valueToTree("")))).doesNotThrowAnyException();
    }
    @Test void rejectsOutOfRangeAndFractionalTolerance() {
        for (String json : new String[]{"-1", "5001", "1.5", "\"500\"", "999999999999999999"})
            assertThatThrownBy(() -> PriceReaderConfigurationValidator.validate(Map.of(
                    "PRICE_READER_MATCH_TOLERANCE_SATANG", mapper.readTree(json))))
                    .isInstanceOf(StoreValidationException.class);
    }
    @Test void rejectsInvalidOrEmptyOutputAndRepeatedBlockIds() {
        for (String json : new String[]{"{}", "[null]", "[{\"id\":\"a\",\"enabled\":false,\"text\":\"hidden\"}]",
                "[{\"id\":\"a\",\"enabled\":true,\"text\":\" \"}]",
                "[{\"id\":\"a\",\"enabled\":true,\"text\":\"A\"},{\"id\":\"a\",\"enabled\":true,\"text\":\"B\"}]"})
            assertThatThrownBy(() -> PriceReaderConfigurationValidator.validate(Map.of(
                    "PRICE_READER_RESULT_BLOCKS", mapper.readTree(json))))
                    .isInstanceOf(StoreValidationException.class);
    }
    @Test void acceptsDisabledBlocksAndRejectsOversizedCombinedText() {
        var blocks = mapper.createArrayNode();
        blocks.addObject().put("id", "name").put("enabled", true).put("text", "{{item_name}}");
        blocks.addObject().put("id", "hidden").put("enabled", false).put("text", "");
        assertThatCode(() -> PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_RESULT_BLOCKS", blocks))).doesNotThrowAnyException();
        for (int i = 0; i < 4; i++) blocks.addObject().put("id", "long" + i).put("enabled", true).put("text", "x".repeat(1000));
        assertThatThrownBy(() -> PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_RESULT_BLOCKS", blocks))).isInstanceOf(StoreValidationException.class);
    }
    @Test void rejectsBlankErrorTextAndOversizedSeparators() {
        assertThatThrownBy(() -> PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_NOT_FOUND_TEXT", mapper.valueToTree(" ")))).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(() -> PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_RESULTS_SEPARATOR", mapper.valueToTree("x".repeat(101))))).isInstanceOf(StoreValidationException.class);
    }
}
