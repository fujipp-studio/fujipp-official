package com.fujipp.backend.store;

import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.runtime.RuntimeService;
import com.fujipp.backend.runtime.RuntimeSlotService;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminBotServiceTests {

    private final AdminBotRepository repository = mock(AdminBotRepository.class);
    private final RuntimeService runtime = mock(RuntimeService.class);
    private final AdminBotService service = new AdminBotService(
            repository,
            mock(RuntimeSlotService.class),
            mock(StoreRepository.class),
            mock(StoreService.class),
            mock(CursorCodec.class),
            runtime
    );

    @Test
    void removesInstalledFeatureAndInvalidatesRuntimeBootstrap() {
        UUID botId = UUID.randomUUID();
        UUID installationId = UUID.randomUUID();
        when(repository.ownerId(botId)).thenReturn(UUID.randomUUID());
        when(repository.installedFeatureCode(botId, installationId)).thenReturn("wallet-topup");
        when(repository.removeFeatureInstallation(botId, installationId)).thenReturn(true);

        service.removeFeature(botId, installationId);

        verify(repository).removeFeatureInstallation(botId, installationId);
        verify(runtime).invalidateBootstrap();
    }

    @Test
    void rejectsCoreFeatureRemoval() {
        UUID botId = UUID.randomUUID();
        UUID installationId = UUID.randomUUID();
        when(repository.ownerId(botId)).thenReturn(UUID.randomUUID());
        when(repository.installedFeatureCode(botId, installationId)).thenReturn("bot-permissions");

        assertThatThrownBy(() -> service.removeFeature(botId, installationId))
                .isInstanceOf(StoreConflictException.class)
                .hasMessage("Core features cannot be removed from a bot");

        verify(repository, never()).removeFeatureInstallation(botId, installationId);
        verify(runtime, never()).invalidateBootstrap();
    }

    @Test
    void rejectsInstallationThatIsNotActiveOnTheBot() {
        UUID botId = UUID.randomUUID();
        UUID installationId = UUID.randomUUID();
        when(repository.ownerId(botId)).thenReturn(UUID.randomUUID());

        assertThatThrownBy(() -> service.removeFeature(botId, installationId))
                .isInstanceOf(StoreNotFoundException.class)
                .hasMessage("Installed feature was not found");

        verify(repository, never()).removeFeatureInstallation(botId, installationId);
        verify(runtime, never()).invalidateBootstrap();
    }
}
