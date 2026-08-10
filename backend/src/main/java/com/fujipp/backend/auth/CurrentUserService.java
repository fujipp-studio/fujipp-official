package com.fujipp.backend.auth;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class CurrentUserService {

    private final CurrentUserRepository currentUserRepository;

    public CurrentUserService(CurrentUserRepository currentUserRepository) {
        this.currentUserRepository = currentUserRepository;
    }

    public CurrentUser getActiveUser(Jwt jwt) {
        CurrentUserRepository.AccountProfile profile = getActiveAccount(jwt.getSubject());
        long walletBalanceSatang = currentUserRepository.findWalletBalanceByUserId(profile.id());

        return new CurrentUser(
                profile.id(),
                jwt.getClaimAsString("email"),
                profile.role(),
                profile.status(),
                profile.username(),
                profile.displayName(),
                profile.firstName(),
                profile.lastName(),
                profile.avatarUrl(),
                profile.profileCompletedAt(),
                walletBalanceSatang
        );
    }

    public CurrentUserRepository.AccountProfile getActiveAccount(String subject) {
        UUID userId = parseUserId(subject);
        CurrentUserRepository.AccountProfile profile = currentUserRepository.findById(userId)
                .orElseThrow(UserAccountNotFoundException::new);

        if (profile.status() != AccountStatus.ACTIVE) {
            throw new AccountNotActiveException(profile.status());
        }

        return profile;
    }

    private UUID parseUserId(String subject) {
        try {
            return UUID.fromString(subject);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new InvalidTokenSubjectException();
        }
    }
}
