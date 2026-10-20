package com.fujipp.backend.auth;

import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.runtime.RuntimeService;
import com.fujipp.backend.store.StoreConflictException;
import com.fujipp.backend.store.StoreNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminUserFeatureRemovalTests {
    private final AdminUserRepository repository = mock(AdminUserRepository.class);
    private final RuntimeService runtime = mock(RuntimeService.class);
    private final AdminUserService service = new AdminUserService(repository, mock(CursorCodec.class), runtime);
    private final UUID userId = UUID.randomUUID(), licenseId = UUID.randomUUID();

    private void license(String code, String status, int installed) {
        when(repository.lockFeatureLicense(userId, licenseId)).thenReturn(Optional.of(
                new AdminUserResponses.FeatureLicense(licenseId, UUID.randomUUID(), code, code,
                        "1.0.0", status, 3, OffsetDateTime.now(), null, installed)));
        when(repository.revokeFeatureLicense(userId, licenseId)).thenReturn(true);
    }

    @Test void removesOwnedLicenseAndEveryInstallationThenInvalidatesRuntime() {
        license("review-credit", "ACTIVE", 2);
        service.removeFeature(userId, licenseId);
        var order = inOrder(repository, runtime);
        order.verify(repository).lockFeatureLicense(userId, licenseId);
        order.verify(repository).revokeFeatureLicense(userId, licenseId);
        order.verify(repository).removeFeatureInstallations(userId, licenseId);
        order.verify(runtime).invalidateBootstrap();
        verifyNoMoreInteractions(repository);
    }

    @Test void missingOrForeignLicenseCannotChangeOtherUsersInventory() {
        assertThatThrownBy(() -> service.removeFeature(userId, licenseId)).isInstanceOf(StoreNotFoundException.class);
        verify(repository).lockFeatureLicense(userId, licenseId);
        verifyNoMoreInteractions(repository);
        verifyNoInteractions(runtime);
    }

    @Test void installedCoreFeaturesRemainProtected() {
        for (String code : new String[]{"bot-presence", "bot-permissions", "runtime-expiry-alert"}) {
            license(code, "ACTIVE", 1);
            assertThatThrownBy(() -> service.removeFeature(userId, licenseId)).isInstanceOf(StoreConflictException.class);
        }
        verify(repository, never()).revokeFeatureLicense(any(), any());
        verify(repository, never()).removeFeatureInstallations(any(), any());
        verifyNoInteractions(runtime);
    }

    @Test void unusedCoreLicensesCanBeRemovedFromInventory() {
        license("bot-presence", "ACTIVE", 0);
        service.removeFeature(userId, licenseId);
        verify(repository).revokeFeatureLicense(userId, licenseId);
        verify(repository).removeFeatureInstallations(userId, licenseId);
    }

    @Test void removalIsRetryableForAlreadyRevokedLicenses() {
        license("review-credit", "REVOKED", 0);
        service.removeFeature(userId, licenseId);
        verify(repository).revokeFeatureLicense(userId, licenseId);
        verify(runtime).invalidateBootstrap();
    }

    @Test void failedRevocationDoesNotRemoveInstallations() {
        license("review-credit", "SUSPENDED", 1);
        when(repository.revokeFeatureLicense(userId, licenseId)).thenReturn(false);
        assertThatThrownBy(() -> service.removeFeature(userId, licenseId)).isInstanceOf(StoreNotFoundException.class);
        verify(repository, never()).removeFeatureInstallations(any(), any());
        verifyNoInteractions(runtime);
    }

    @Test void failedInstallationRemovalDoesNotPublishARuntimeChange() {
        license("review-credit", "ACTIVE", 2);
        doThrow(new IllegalStateException("Database unavailable")).when(repository).removeFeatureInstallations(userId, licenseId);
        assertThatThrownBy(() -> service.removeFeature(userId, licenseId)).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(runtime);
    }

    @Test void runtimeInvalidationWaitsUntilTheRemovalTransactionCommits() {
        license("review-credit", "ACTIVE", 1);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.removeFeature(userId, licenseId);
            verifyNoInteractions(runtime);
            TransactionSynchronizationManager.getSynchronizations().forEach(sync -> sync.afterCommit());
            verify(runtime).invalidateBootstrap();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }
}
