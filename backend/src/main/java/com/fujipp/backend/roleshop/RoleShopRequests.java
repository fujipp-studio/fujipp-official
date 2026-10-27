package com.fujipp.backend.roleshop;

import jakarta.validation.constraints.*;
import java.util.UUID;

final class RoleShopRequests {
    record Begin(@NotNull UUID botId,
                 @NotBlank @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,
                 @NotBlank @Pattern(regexp="^[a-z0-9_-]{1,40}$") String productKey,
                 @NotBlank @Pattern(regexp="^[0-9]{15,30}$") String roleId,
                 @Positive @Max(9007199254740991L) long priceSatang,
                 @NotBlank @Pattern(regexp="^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey) {}
    record Complete(@NotNull UUID claimToken) {}
    record Refund(@NotNull UUID claimToken, @NotBlank @Size(max=500) String reason) {}
}
