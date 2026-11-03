package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;

final class PriceReaderConfigurationValidator {
    private PriceReaderConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
        JsonNode pricingMode = values.get("PRICE_READER_PRICING_MODE");
        if (pricingMode != null && (!pricingMode.isTextual() || !(pricingMode.asText().equals("STANDARD") || pricingMode.asText().equals("NITRO") || pricingMode.asText().equals("BOTH"))))
            throw new StoreValidationException("Price Reader pricing mode must be STANDARD, NITRO or BOTH");
        validateRules(values.get("PRICE_READER_PRICE_RULES"), false);
        validateRules(values.get("PRICE_READER_COUNT_PRICE_RULES"), true);
        JsonNode language=values.get("PRICE_READER_LANGUAGE");
        if (language!=null && (!language.isTextual() || !java.util.Set.of("TH","EN").contains(language.asText())))
            throw new StoreValidationException("Price Reader language must be TH or EN");
        JsonNode model = values.get("PRICE_READER_GEMINI_MODEL");
        if (model != null && (!model.isTextual() || !model.asText().matches(PriceReaderGeminiClient.MODEL_PATTERN))) {
            throw new StoreValidationException("Invalid Gemini model name");
        }
        JsonNode mode = values.get("PRICE_READER_RESULT_MODE");
        if (mode != null && (!mode.isTextual() || !(mode.asText().equals("TEMPLATE") || mode.asText().equals("BLOCKS")))) {
            throw new StoreValidationException("Price Reader result mode must be TEMPLATE or BLOCKS");
        }
        JsonNode tolerance = values.get("PRICE_READER_MATCH_TOLERANCE_SATANG");
        if (tolerance != null && (!tolerance.isIntegralNumber() || !tolerance.canConvertToInt()
                || tolerance.asInt() < 0 || tolerance.asInt() > 5000)) {
            throw new StoreValidationException("Price matching tolerance must be 0–5000 satang");
        }
        for (var key : new String[]{"PRICE_READER_NOT_FOUND_TEXT", "PRICE_READER_OCR_ERROR_TEXT",
                "PRICE_READER_UNMATCHED_PRICE_TEXT", "PRICE_READER_ERROR_ITEM_TEMPLATE",
                "PRICE_READER_RESULTS_ITEM_TEMPLATE", "PRICE_READER_RESULTS_SEPARATOR"}) {
            JsonNode value = values.get(key);
            if (value == null) continue;
            int maximum = key.endsWith("SEPARATOR") ? 100 : key.endsWith("TEMPLATE") ? 4000 : 1000;
            if (!value.isTextual() || value.asText().length() > maximum
                    || (!key.endsWith("SEPARATOR") && value.asText().isBlank())) {
                throw new StoreValidationException("Invalid text length for " + key);
            }
        }
        JsonNode blocks = values.get("PRICE_READER_RESULT_BLOCKS");
        if (blocks == null) return;
        if (!blocks.isArray() || blocks.size() > 12) {
            throw new StoreValidationException("Price Reader supports at most 12 result blocks");
        }
        var ids = new HashSet<String>();
        int activeLength = 0;
        for (JsonNode block : blocks) {
            JsonNode id = block.get("id"), enabled = block.get("enabled"), text = block.get("text");
            if (!block.isObject() || id == null || !id.isTextual() || id.asText().isBlank()
                    || id.asText().length() > 64 || !ids.add(id.asText())
                    || enabled == null || !enabled.isBoolean() || text == null || !text.isTextual()
                    || text.asText().length() > 1000 || (enabled.asBoolean() && text.asText().isBlank())) {
                throw new StoreValidationException("Each result block needs a unique ID, enabled flag and valid text");
            }
            if (enabled.asBoolean()) activeLength += text.asText().length() + 1;
        }
        boolean useBlocks = mode == null ? !blocks.isEmpty() : mode.asText().equals("BLOCKS");
        if (useBlocks && (activeLength == 0 || activeLength > 4001)) {
            throw new StoreValidationException("Enable at least one result block; combined text must be at most 4000 characters");
        }
    }
    private static void validateRules(JsonNode rules, boolean counted) {
        if (rules==null) return;
        if (!rules.isArray() || rules.size()>400) throw new StoreValidationException("Price Reader supports at most 400 price rules");
        var keys=new HashSet<String>();
        for (JsonNode rule:rules) {
            String kind=rule.path("itemType").asText(""), tier=rule.path("pricingMode").asText("");
            JsonNode count=rule.path("itemCount");
            if (counted && (!count.isIntegralNumber() || !count.canConvertToInt() || count.asInt()<1 || count.asInt()>5 || kind.equals("SINGLE") != (count.asInt()==1)))
                throw new StoreValidationException("Single items require itemCount 1; bundles require itemCount 2–5");
            JsonNode discord=rule.path("discordPriceSatang"), shop=rule.path("shopPriceSatang");
            if (!rule.isObject() || !(kind.equals("SINGLE") || kind.equals("BUNDLE")) || !(tier.equals("STANDARD") || tier.equals("NITRO"))
                    || !discord.isIntegralNumber() || !discord.canConvertToLong() || discord.asLong()<1 || discord.asLong()>100_000_000
                    || !shop.isIntegralNumber() || !shop.canConvertToLong() || shop.asLong()<0 || shop.asLong()>100_000_000
                    || !keys.add(kind+"/"+(counted ? count.asInt() : "legacy")+"/"+tier+"/"+discord.asLong()))
                throw new StoreValidationException("Each price rule needs a type, mode and valid satang amounts; duplicate prices within the same type and mode are not allowed");
        }
    }

}
