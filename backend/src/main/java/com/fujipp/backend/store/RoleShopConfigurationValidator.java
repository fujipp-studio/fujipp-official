package com.fujipp.backend.store;

import tools.jackson.databind.JsonNode;
import java.util.*;

final class RoleShopConfigurationValidator {
    static void validate(Map<String,JsonNode> values) {
        JsonNode command=values.get("ROLE_SHOP_COMMAND_NAME");
        if (command!=null && (!command.isTextual() || !command.asText().matches("^[a-z0-9_-]{1,32}$")))
            throw new StoreValidationException("Role shop command must contain 1–32 lowercase letters, digits, underscores or hyphens");
        JsonNode products=values.get("ROLE_SHOP_PRODUCTS");
        if (products==null) return;
        if (!products.isArray() || products.size()>25) throw new StoreValidationException("Role shop supports up to 25 products");
        Set<String> keys=new HashSet<>(), roles=new HashSet<>();
        for (JsonNode product:products) {
            var key=product.path("key"); var name=product.path("name"); var role=product.path("roleId"); var price=product.path("priceSatang");
            if (!key.isTextual() || !key.asText().matches("^[a-z0-9_-]{1,40}$") || !keys.add(key.asText())
                || !name.isTextual() || name.asText().isBlank() || name.asText().length()>100
                || !role.isTextual() || !role.asText().matches("^[0-9]{15,30}$") || !roles.add(role.asText())
                || !price.isIntegralNumber() || !price.canConvertToLong() || price.asLong()<1 || price.asLong()>9007199254740991L)
                throw new StoreValidationException("Each role product needs a unique key, name, unique Discord role and a positive integer price in satang");
        }
    }
}
