package com.fujipp.backend.profile;

import com.fujipp.backend.auth.AccountStatus;
import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.security.SecurityAuditService;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProfileServiceTests {

    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final CurrentUserRepository repository = mock(CurrentUserRepository.class);
    private final SecurityAuditService securityAuditService = mock(SecurityAuditService.class);
    private final ProfileService service =
            new ProfileService(currentUserService, repository, securityAuditService);

    @Test
    void replacesEditableProfileFields() {
        UUID userId = UUID.randomUUID();
        CurrentUserRepository.AccountProfile before = account(userId, null, null);
        CurrentUserRepository.AccountProfile after = account(userId, null, "Fujipp");
        when(currentUserService.getActiveAccount(userId.toString())).thenReturn(before);
        when(repository.findById(userId)).thenReturn(Optional.of(after));

        ProfileResponse response = service.updateProfile(
                userId.toString(),
                new UpdateProfileRequest("  Fujipp  ", null, null)
        );

        verify(repository).updateProfile(userId, "Fujipp", null, null);
        assertThat(response.displayName()).isEqualTo("Fujipp");
    }

    @Test
    void setsUsernameOnlyWhenItHasNotBeenSet() {
        UUID userId = UUID.randomUUID();
        CurrentUserRepository.AccountProfile before = account(userId, null, "Fujipp");
        CurrentUserRepository.AccountProfile after = account(userId, "fujipp", "Fujipp");
        when(currentUserService.getActiveAccount(userId.toString())).thenReturn(before);
        when(repository.setUsername(userId, "fujipp")).thenReturn(true);
        when(repository.findById(userId)).thenReturn(Optional.of(after));

        ProfileResponse response = service.setUsername(
                userId.toString(),
                new SetUsernameRequest("fujipp")
        );

        assertThat(response.username()).isEqualTo("fujipp");
    }

    @Test
    void rejectsReplacingExistingUsername() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(account(userId, "existing", "Fujipp"));
        when(repository.setUsername(userId, "new_name")).thenReturn(false);

        assertThatThrownBy(() -> service.setUsername(
                userId.toString(),
                new SetUsernameRequest("new_name")
        )).isInstanceOf(UsernameAlreadySetException.class);
    }

    @Test
    void rejectsReservedUsername() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(account(userId, null, "Fujipp"));
        when(repository.usernameIsReserved("admin")).thenReturn(true);

        assertThatThrownBy(() -> service.setUsername(
                userId.toString(),
                new SetUsernameRequest("admin")
        ))
                .isInstanceOf(UsernameUnavailableException.class)
                .extracting(exception -> ((UsernameUnavailableException) exception).getReason())
                .isEqualTo(UsernameUnavailableException.Reason.RESERVED);
    }

    @Test
    void rejectsUsernameOwnedByAnotherUser() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(account(userId, null, "Fujipp"));
        when(repository.usernameExists("taken_name")).thenReturn(true);

        assertThatThrownBy(() -> service.setUsername(
                userId.toString(),
                new SetUsernameRequest("taken_name")
        ))
                .isInstanceOf(UsernameUnavailableException.class)
                .extracting(exception -> ((UsernameUnavailableException) exception).getReason())
                .isEqualTo(UsernameUnavailableException.Reason.TAKEN);
    }

    @Test
    void deactivatesTheCurrentAccountAndWritesAnAuditEvent() {
        UUID userId = UUID.randomUUID();
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(account(userId, "fujipp", "Fujipp"));
        when(repository.deactivateAccount(userId)).thenReturn(true);

        service.deactivateAccount(userId.toString());

        verify(repository).deactivateAccount(userId);
        verify(securityAuditService).record(
                com.fujipp.backend.security.SecurityEventType.ACCOUNT_DEACTIVATED,
                com.fujipp.backend.security.AuditOutcome.SUCCESS,
                userId,
                userId,
                null,
                null,
                java.util.Map.of()
        );
    }

    private CurrentUserRepository.AccountProfile account(
            UUID userId,
            String username,
            String displayName
    ) {
        return new CurrentUserRepository.AccountProfile(
                userId,
                AppRole.USER,
                AccountStatus.ACTIVE,
                username,
                displayName,
                null,
                null,
                null,
                null
        );
    }
}
