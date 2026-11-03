package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PriceReaderConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test void validatesGeminiModelNamesWithoutAcceptingEndpointsOrPaths() {
        assertThatCode(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_GEMINI_MODEL",mapper.valueToTree("gemini-3.5-flash-lite")))).doesNotThrowAnyException();
        for(String model:new String[]{"", "https://example.com", "../gemini", "gemini-model?key=secret", "gemini-model/other"})
            assertThatThrownBy(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_GEMINI_MODEL",mapper.valueToTree(model)))).isInstanceOf(StoreValidationException.class);
    }

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
    @Test void classifiedRulesScopeDuplicatesByModeAndProductType() {
        var rows=mapper.readTree("""
          [{"itemType":"SINGLE","pricingMode":"STANDARD","discordPriceSatang":25000,"shopPriceSatang":5500},
           {"itemType":"BUNDLE","pricingMode":"STANDARD","discordPriceSatang":25000,"shopPriceSatang":8000},
           {"itemType":"SINGLE","pricingMode":"NITRO","discordPriceSatang":25000,"shopPriceSatang":4500}]
          """);
        assertThatCode(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_PRICING_MODE",mapper.valueToTree("NITRO"),"PRICE_READER_PRICE_RULES",rows))).doesNotThrowAnyException();
        assertThatCode(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_PRICING_MODE",mapper.valueToTree("BOTH"),"PRICE_READER_PRICE_RULES",rows))).doesNotThrowAnyException();
        ((tools.jackson.databind.node.ArrayNode) rows).add(rows.get(0).deepCopy());
        assertThatThrownBy(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_PRICE_RULES",rows))).isInstanceOf(StoreValidationException.class);
        for(String row:new String[]{"{}","{\"itemType\":\"UNKNOWN\",\"pricingMode\":\"NITRO\",\"discordPriceSatang\":25000,\"shopPriceSatang\":50}",
            "{\"itemType\":\"SINGLE\",\"pricingMode\":\"NITRO\",\"discordPriceSatang\":25000,\"shopPriceSatang\":1.5}",
            "{\"itemType\":\"SINGLE\",\"pricingMode\":\"BOTH\",\"discordPriceSatang\":25000,\"shopPriceSatang\":50}"})
            assertThatThrownBy(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_PRICE_RULES",mapper.readTree("["+row+"]")))).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_PRICING_MODE",mapper.valueToTree("AUTO")))).isInstanceOf(StoreValidationException.class);
    }

    @Test void countedRulesAllowEqualPricesAcrossCountsButRejectDuplicatesAndInvalidCounts() {
        var json=new tools.jackson.databind.ObjectMapper();
        String row="{\"itemType\":\"BUNDLE\",\"itemCount\":2,\"pricingMode\":\"NITRO\",\"discordPriceSatang\":47500,\"shopPriceSatang\":10000}";
        assertThatCode(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_COUNT_PRICE_RULES",json.readTree("["+row+","+row.replace("\"itemCount\":2","\"itemCount\":3")+"]")))).doesNotThrowAnyException();
        for (String invalid:new String[]{"["+row+","+row+"]","["+row.replace("\"itemCount\":2","\"itemCount\":1")+"]","["+row.replace("\"itemCount\":2","\"itemCount\":6")+"]"})
            assertThatThrownBy(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_COUNT_PRICE_RULES",json.readTree(invalid)))).isInstanceOf(StoreValidationException.class);
        assertThatThrownBy(()->PriceReaderConfigurationValidator.validate(Map.of("PRICE_READER_LANGUAGE",json.valueToTree("FR")))).isInstanceOf(StoreValidationException.class);
    }

}
