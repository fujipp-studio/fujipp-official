package com.fujipp.backend.runtime;

import com.fujipp.backend.auth.CurrentUserService;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import java.util.List;
import java.util.UUID;
import static org.mockito.Mockito.*;

class RuntimeSlotServiceTests {
    private final RuntimeSlotRepository repository = mock(RuntimeSlotRepository.class);
    private final RuntimeService runtime = mock(RuntimeService.class);
    private final RuntimeSlotService service = new RuntimeSlotService(repository, mock(CurrentUserService.class), runtime);

    @Test
    void preservesBootstrapCacheWhenExpiryAndRenewalsHaveNotChanged() {
        when(repository.dueAutoRenewals()).thenReturn(List.of());
        service.reconcile();
        verify(repository, times(2)).reconcileExpiry();
        verifyNoInteractions(runtime);
    }

    @Test
    void invalidatesAfterExpiryChangesEvenWithoutRenewals() {
        when(repository.reconcileExpiry()).thenReturn(true, false);
        when(repository.dueAutoRenewals()).thenReturn(List.of());
        service.reconcile();
        verify(runtime).invalidateBootstrap();
    }

    @Test
    void invalidatesForSuccessfulRenewalAndStillChecksLaterCandidates() {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID();
        when(repository.dueAutoRenewals()).thenReturn(List.of(first, second));
        when(repository.renewAutomatically(first)).thenReturn(true);
        service.reconcile();
        verify(repository).renewAutomatically(second);
        verify(runtime).invalidateBootstrap();
    }

    @Test
    void skipsInvalidationWhenAnAutomaticRenewalIsDeclined() {
        UUID id = UUID.randomUUID();
        when(repository.dueAutoRenewals()).thenReturn(List.of(id));
        when(repository.renewAutomatically(id)).thenReturn(false);
        service.reconcile();
        verifyNoInteractions(runtime);
    }

    @Test
    void doesNotLoseAnExpiryChangeWhenRenewalFails() {
        UUID id = UUID.randomUUID();
        when(repository.reconcileExpiry()).thenReturn(false, true);
        when(repository.dueAutoRenewals()).thenReturn(List.of(id));
        when(repository.renewAutomatically(id)).thenThrow(new DataAccessResourceFailureException("temporary"));
        service.reconcile();
        verify(runtime).invalidateBootstrap();
    }
}
