package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;

final class PriceReaderConfigurationValidator {
    private PriceReaderConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
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
}
