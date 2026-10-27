package com.fujipp.backend.roleshop;

import java.time.OffsetDateTime;
import java.util.UUID;

record RoleShopPurchase(UUID id, String memberDiscordId, String productKey, String productName,
                        String roleId, long priceSatang, String status, long balanceSatang,
                        UUID claimToken, OffsetDateTime createdAt) {}
