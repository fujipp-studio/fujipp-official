package com.fujipp.backend.store;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
class RoleShopConfigurationValidatorTests {
    @Test void rejectsDuplicateRolesAndFractionalSatang() {
        var json=JsonMapper.builder().build();
        for (String rows:new String[]{
            "[{\"key\":\"vip\",\"name\":\"VIP\",\"roleId\":\"333333333333333333\",\"priceSatang\":1.5}]",
            "[{\"key\":\"vip\",\"name\":\"VIP\",\"roleId\":\"333333333333333333\",\"priceSatang\":100},{\"key\":\"vip2\",\"name\":\"VIP2\",\"roleId\":\"333333333333333333\",\"priceSatang\":200}]"})
            assertThatThrownBy(()->RoleShopConfigurationValidator.validate(Map.of("ROLE_SHOP_PRODUCTS",json.readTree(rows))))
                .isInstanceOf(StoreValidationException.class);
        RoleShopConfigurationValidator.validate(Map.of("ROLE_SHOP_PRODUCTS",json.readTree("[]")));
    }
}
