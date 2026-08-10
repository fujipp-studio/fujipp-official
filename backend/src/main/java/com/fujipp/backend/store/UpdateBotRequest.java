package com.fujipp.backend.store;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateBotRequest(
        @NotBlank @Size(max = 100) String name,
        @Pattern(regexp = "^[0-9]{15,30}$") String discordApplicationId,
        @Pattern(regexp = "^[0-9]{15,30}$") String discordGuildId
) {
}
