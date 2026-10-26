package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MemberSpendingConfigurationValidatorTests {
    private final ObjectMapper mapper = new ObjectMapper();
    private Map<String, JsonNode> values() {
        Map<String, JsonNode> values = new LinkedHashMap<>();
        values.put("SPENDING_MONTHLY_ROLES_ENABLED", mapper.valueToTree(true));
        values.put("SPENDING_MONTHLY_TOP1_ROLE_ID", mapper.valueToTree("111111111111111111"));
        values.put("SPENDING_MONTHLY_TOP5_ROLE_ID", mapper.valueToTree("555555555555555555"));
        return values;
    }
    @Test void allowsOptionalRolesAndDisabledMonthlyRewards() {
        assertThatCode(() -> MemberSpendingConfigurationValidator.validate(Map.of())).doesNotThrowAnyException();
        assertThatCode(() -> MemberSpendingConfigurationValidator.validate(values())).doesNotThrowAnyException();
        var input = values();
        input.put("SPENDING_MONTHLY_ROLES_ENABLED", mapper.valueToTree(false));
        input.put("SPENDING_TOP1_ROLE_ID", input.get("SPENDING_MONTHLY_TOP1_ROLE_ID"));
        assertThatCode(() -> MemberSpendingConfigurationValidator.validate(input)).doesNotThrowAnyException();
    }
    @Test void rejectsRolesSharedWithLifetimeRanksOrFirstPurchase() {
        for (String key : new String[]{"SPENDING_TOP1_ROLE_ID", "SPENDING_TOP5_ROLE_ID", "SPENDING_FIRST_ROLE_ID", "SPENDING_MONTHLY_TOP5_ROLE_ID"}) {
            var input = values(); input.put(key, input.get("SPENDING_MONTHLY_TOP1_ROLE_ID"));
            assertThatThrownBy(() -> MemberSpendingConfigurationValidator.validate(input)).isInstanceOf(StoreValidationException.class);
        }
    }
    @Test void rejectsRolesSharedWithSpendingLevels() {
        var input = values();
        input.put("SPENDING_UPGRADE_TIERS", mapper.valueToTree(java.util.List.of(Map.of("amount", 1000, "roleId", "555555555555555555"))));
        assertThatThrownBy(() -> MemberSpendingConfigurationValidator.validate(input)).isInstanceOf(StoreValidationException.class);
    }
}
