package com.fujipp.backend.auth;

import java.time.OffsetDateTime;
import java.util.UUID;

public record CurrentUser(
        UUID id,
        String email,
        AppRole role,
        AccountStatus status,
        String username,
        String displayName,
        String firstName,
        String lastName,
        String avatarUrl,
        OffsetDateTime profileCompletedAt
) {
}
