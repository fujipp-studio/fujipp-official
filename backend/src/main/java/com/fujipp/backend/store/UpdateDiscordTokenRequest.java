package com.fujipp.backend.store;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDiscordTokenRequest(
        @NotBlank @Size(max = 200) String token
) {
}
