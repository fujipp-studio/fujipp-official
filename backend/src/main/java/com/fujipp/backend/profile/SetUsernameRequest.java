package com.fujipp.backend.profile;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SetUsernameRequest(
        @NotBlank
        @Size(min = 3, max = 50)
        @Pattern(regexp = "^[a-z0-9_]+$")
        String username
) {
}
