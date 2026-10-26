package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class MemberSpendingConfigurationValidator {
    private MemberSpendingConfigurationValidator() {}

    static void validate(Map<String, JsonNode> values) {
        JsonNode enabled = values.get("SPENDING_MONTHLY_ROLES_ENABLED");
        if (enabled == null || !enabled.asBoolean()) return;
        Set<String> lifetime = new HashSet<>();
        for (String key : new String[]{"SPENDING_FIRST_ROLE_ID", "SPENDING_TOP1_ROLE_ID", "SPENDING_TOP5_ROLE_ID"}) {
            JsonNode role = values.get(key);
            if (role != null && !role.isNull() && !role.asText().isBlank()) lifetime.add(role.asText());
        }
        JsonNode tiers = values.get("SPENDING_UPGRADE_TIERS");
        if (tiers != null && tiers.isArray()) {
            for (JsonNode tier : tiers) lifetime.add(tier.path("roleId").asText());
        }
        Set<String> monthly = new HashSet<>();
        for (String key : new String[]{"SPENDING_MONTHLY_TOP1_ROLE_ID", "SPENDING_MONTHLY_TOP5_ROLE_ID"}) {
            JsonNode role = values.get(key);
            if (role == null || role.isNull() || role.asText().isBlank()) continue;
            if (lifetime.contains(role.asText()) || !monthly.add(role.asText()))
                throw new StoreValidationException("Monthly ranking roles must be separate from lifetime roles, spending levels, and each other");
        }
    }
}
