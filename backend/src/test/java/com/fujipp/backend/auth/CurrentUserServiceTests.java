package com.fujipp.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CurrentUserServiceTests {

    private final CurrentUserRepository repository = mock(CurrentUserRepository.class);
    private final CurrentUserService service = new CurrentUserService(repository);

    @Test
    void returnsActiveUserFromJwtAndApplicationAccount() {
        UUID userId = UUID.randomUUID();
        Jwt jwt = jwt(userId.toString(), "user@example.com");
        CurrentUserRepository.AccountProfile profile = new CurrentUserRepository.AccountProfile(
                userId,
                AppRole.USER,
                AccountStatus.ACTIVE,
                "fujipp",
                "Fujipp",
                null,
                null,
                "https://example.com/avatar.png",
                null
        );
        when(repository.findById(userId)).thenReturn(Optional.of(profile));

        CurrentUser currentUser = service.getActiveUser(jwt);

        assertThat(currentUser.id()).isEqualTo(userId);
        assertThat(currentUser.email()).isEqualTo("user@example.com");
        assertThat(currentUser.role()).isEqualTo(AppRole.USER);
        assertThat(currentUser.status()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(currentUser.username()).isEqualTo("fujipp");
    }

    @Test
    void rejectsAccountThatIsNotActive() {
        UUID userId = UUID.randomUUID();
        CurrentUserRepository.AccountProfile profile = new CurrentUserRepository.AccountProfile(
                userId,
                AppRole.USER,
                AccountStatus.BANNED,
                null,
                null,
                null,
                null,
                null,
                null
        );
        when(repository.findById(userId)).thenReturn(Optional.of(profile));

        assertThatThrownBy(() -> service.getActiveUser(jwt(userId.toString(), "user@example.com")))
                .isInstanceOf(AccountNotActiveException.class)
                .extracting(exception -> ((AccountNotActiveException) exception).getStatus())
                .isEqualTo(AccountStatus.BANNED);
    }

    @Test
    void rejectsTokenWithNonUuidSubject() {
        assertThatThrownBy(() -> service.getActiveUser(jwt("not-a-uuid", "user@example.com")))
                .isInstanceOf(InvalidTokenSubjectException.class);
    }

    @Test
    void rejectsAuthenticatedUserWithoutApplicationAccount() {
        UUID userId = UUID.randomUUID();
        when(repository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getActiveUser(jwt(userId.toString(), "user@example.com")))
                .isInstanceOf(UserAccountNotFoundException.class);
    }

    private Jwt jwt(String subject, String email) {
        Instant issuedAt = Instant.now();
        return new Jwt(
                "token",
                issuedAt,
                issuedAt.plusSeconds(300),
                Map.of("alg", "RS256"),
                Map.of("sub", subject, "email", email)
        );
    }
}
