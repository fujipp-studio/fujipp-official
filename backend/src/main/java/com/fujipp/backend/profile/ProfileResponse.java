package com.fujipp.backend.profile;

import com.fujipp.backend.auth.CurrentUserRepository;

import java.time.OffsetDateTime;
import java.util.UUID;

public record ProfileResponse(
        UUID id,
        String username,
        String displayName,
        String firstName,
        String lastName,
        String avatarUrl,
        OffsetDateTime profileCompletedAt
) {
    static ProfileResponse from(CurrentUserRepository.AccountProfile profile) {
        return new ProfileResponse(
                profile.id(),
                profile.username(),
                profile.displayName(),
                profile.firstName(),
                profile.lastName(),
                profile.avatarUrl(),
                profile.profileCompletedAt()
        );
    }
}
