package com.fujipp.backend.profile;

import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import com.fujipp.backend.security.AuditOutcome;
import com.fujipp.backend.security.SecurityAuditService;
import com.fujipp.backend.security.SecurityEventType;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class ProfileService {

    private final CurrentUserService currentUserService;
    private final CurrentUserRepository currentUserRepository;
    private final SecurityAuditService securityAuditService;

    public ProfileService(
            CurrentUserService currentUserService,
            CurrentUserRepository currentUserRepository,
            SecurityAuditService securityAuditService
    ) {
        this.currentUserService = currentUserService;
        this.currentUserRepository = currentUserRepository;
        this.securityAuditService = securityAuditService;
    }

    @Transactional(readOnly = true)
    public ProfileResponse getProfile(String subject) {
        return ProfileResponse.from(currentUserService.getActiveAccount(subject));
    }

    @Transactional
    public ProfileResponse updateProfile(String subject, UpdateProfileRequest request) {
        CurrentUserRepository.AccountProfile account = currentUserService.getActiveAccount(subject);
        currentUserRepository.updateProfile(
                account.id(),
                normalize(request.displayName()),
                normalize(request.firstName()),
                normalize(request.lastName())
        );
        return reload(account.id());
    }

    @Transactional
    public ProfileResponse setUsername(String subject, SetUsernameRequest request) {
        CurrentUserRepository.AccountProfile account = currentUserService.getActiveAccount(subject);
        String username = request.username().trim().toLowerCase(Locale.ROOT);

        if (account.username() != null) {
            throw new UsernameAlreadySetException();
        }
        if (currentUserRepository.usernameIsReserved(username)) {
            throw new UsernameUnavailableException(UsernameUnavailableException.Reason.RESERVED);
        }
        if (currentUserRepository.usernameExists(username)) {
            throw new UsernameUnavailableException(UsernameUnavailableException.Reason.TAKEN);
        }

        try {
            if (!currentUserRepository.setUsername(account.id(), username)) {
                throw new UsernameAlreadySetException();
            }
        } catch (DataIntegrityViolationException exception) {
            throw new UsernameUnavailableException(UsernameUnavailableException.Reason.TAKEN);
        }

        securityAuditService.record(
                SecurityEventType.USERNAME_SET,
                AuditOutcome.SUCCESS,
                account.id(),
                account.id(),
                null,
                null,
                java.util.Map.of()
        );
        return reload(account.id());
    }

    @Transactional
    public void deactivateAccount(String subject) {
        CurrentUserRepository.AccountProfile account = currentUserService.getActiveAccount(subject);
        if (!currentUserRepository.deactivateAccount(account.id())) {
            throw new ProfileValidationException("Account could not be deactivated");
        }
        securityAuditService.record(
                SecurityEventType.ACCOUNT_DEACTIVATED,
                AuditOutcome.SUCCESS,
                account.id(),
                account.id(),
                null,
                null,
                java.util.Map.of()
        );
    }

    private ProfileResponse reload(java.util.UUID userId) {
        return currentUserRepository.findById(userId)
                .map(ProfileResponse::from)
                .orElseThrow(com.fujipp.backend.auth.UserAccountNotFoundException::new);
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }
}
