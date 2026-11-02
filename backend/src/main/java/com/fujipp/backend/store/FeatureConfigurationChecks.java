package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Validate the effective saved + draft configuration before writes or activation retry. */
final class FeatureConfigurationChecks {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private FeatureConfigurationChecks() {}

    static Map<String, JsonNode> validate(FeatureConfigurationResponse saved, Map<String, JsonNode> changes, Map<String, String> secrets) {
        Map<String, JsonNode> effective = new LinkedHashMap<>();
        if (saved != null) for (var field : saved.fields()) {
            JsonNode value = changes.getOrDefault(field.key(), field.value() == null ? field.defaultValue() : field.value());
            if (field.secret()) {
                if (secrets.containsKey(field.key())) value = MAPPER.valueToTree(field.key().equals("GEMINI_API_KEY") && secrets.get(field.key()) != null ? secrets.get(field.key()).trim() : secrets.get(field.key()));
                else if (field.configured()) continue;
            } else if (value != null && !value.isNull()) effective.put(field.key(), value);
            boolean empty = value == null || value.isNull() || value.isTextual() && value.asText().isBlank();
            if (empty) {
                if (field.required()) fail(field.key(), "is required (" + field.label() + ")");
                continue;
            }
            if (java.util.Set.of("CHANNEL_ID", "ROLE_ID", "USER_ID").contains(field.type())
                    && (!value.isTextual() || !value.asText().matches("[0-9]{15,30}"))) fail(field.key(), "must be a Discord ID with 15–30 digits");
            validateNode(field.key(), value, field.validation(), 0);
            if (field.key().equals("PRESENCE_ROTATE_SECONDS") && (!value.isIntegralNumber() || value.asLong() < 20 || value.asLong() > 86400))
                fail(field.key(), "must be an integer from 20 to 86400");
        }
        effective.putAll(changes);
        MessageSetsConfigurationValidator.validate(effective);
        TicketConfigurationValidator.validate(effective);
        PriceReaderConfigurationValidator.validate(effective);
        RoleShopConfigurationValidator.validate(effective);
        WalletQrConfigurationValidator.validate(effective);
        ShopStatusConfigurationValidator.validate(effective);
        MemberSpendingConfigurationValidator.validate(effective);
        return effective;
    }

    private static void validateNode(String key, JsonNode value, JsonNode schema, int depth) {
        if (schema == null || !schema.isObject() || depth > 20) return;
        JsonNode type = schema.path("type");
        if (type.isTextual()) {
            boolean valid = switch (type.asText()) {
                case "array" -> value.isArray(); case "object" -> value.isObject();
                case "string" -> value.isTextual(); case "integer" -> value.isIntegralNumber();
                case "number" -> value.isNumber(); case "boolean" -> value.isBoolean(); default -> true;
            };
            if (!valid) fail(key, "must have type " + type.asText());
        }
        JsonNode options = schema.path("enum");
        if (options.isArray()) {
            boolean found = false;
            for (var option : options) if (option.equals(value)) found = true;
            if (!found) fail(key, "must be one of the allowed options");
        }
        if (value.isNumber()) {
            for (String bound : new String[]{"minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum"}) {
                JsonNode limit = schema.path(bound);
                if (!limit.isNumber()) continue;
                int comparison = value.decimalValue().compareTo(limit.decimalValue());
                if (bound.equals("minimum") && comparison < 0 || bound.equals("maximum") && comparison > 0
                        || bound.equals("exclusiveMinimum") && comparison <= 0 || bound.equals("exclusiveMaximum") && comparison >= 0)
                    fail(key, bound + " " + limit.asText());
            }
        }
        if (value.isTextual()) {
            int length = value.asText().length();
            if (schema.path("minLength").isNumber() && length < schema.path("minLength").asInt()) fail(key, "is too short");
            if (schema.path("maxLength").isNumber() && length > schema.path("maxLength").asInt()) fail(key, "is too long");
            if (schema.path("pattern").isTextual() && !Pattern.compile(schema.path("pattern").asText()).matcher(value.asText()).matches()) fail(key, "has an invalid format");
        }
        if (value.isArray()) {
            if (schema.path("minItems").isNumber() && value.size() < schema.path("minItems").asInt()) fail(key, "needs more items");
            if (schema.path("maxItems").isNumber() && value.size() > schema.path("maxItems").asInt()) fail(key, "has too many items");
            int index = 0;
            for (var item : value) validateNode(key + "[" + index++ + "]", item, schema.path("items"), depth + 1);
        }
        if (value.isObject()) {
            for (var required : schema.path("required")) if (!value.hasNonNull(required.asText())) fail(key + "." + required.asText(), "is required");
            for (var property : schema.path("properties").properties()) if (value.has(property.getKey()))
                validateNode(key + "." + property.getKey(), value.get(property.getKey()), property.getValue(), depth + 1);
        }
    }
    private static void fail(String key, String reason) { throw new StoreValidationException(key + ": " + reason); }
}
