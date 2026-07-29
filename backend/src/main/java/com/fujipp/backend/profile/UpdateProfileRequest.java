package com.fujipp.backend.profile;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(min = 1, max = 50) String displayName,
        @Size(min = 1, max = 100) String firstName,
        @Size(min = 1, max = 100) String lastName
) {
}
