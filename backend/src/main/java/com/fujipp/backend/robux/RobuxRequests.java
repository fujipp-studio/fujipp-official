package com.fujipp.backend.robux;

import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;

final class RobuxRequests {
    private RobuxRequests() {}
    record Begin(@NotNull UUID botId,
                 @NotBlank @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,
                 @Positive long robloxUserId,
                 @NotBlank @Pattern(regexp="^[A-Za-z0-9_]{3,20}$") String robloxUsername,
                 @NotBlank @Pattern(regexp="^[A-Za-z0-9_-]{1,40}$") String groupKey,
                 @Positive long groupId,
                 @Positive long robuxAmount,
                 @Positive long priceSatang,
                 @NotBlank @Pattern(regexp="^[A-Za-z0-9._:-]{8,100}$") String idempotencyKey) {}
    record Outcome(@NotBlank @Pattern(regexp="^(SUCCEEDED|REVIEW_REQUIRED)$") String status,
                   @NotNull Map<String,Object> result,
                   @Size(max=80) String errorCode,
                   @Size(max=500) String errorMessage) {}
    record Failure(@NotBlank @Size(max=80) String errorCode,
                   @NotBlank @Size(max=500) String errorMessage) {}
}
