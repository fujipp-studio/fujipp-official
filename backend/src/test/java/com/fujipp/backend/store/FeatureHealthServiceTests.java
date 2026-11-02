package com.fujipp.backend.store;

import com.fujipp.backend.auth.*;
import com.fujipp.backend.runtime.RuntimeService;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class FeatureHealthServiceTests {
    private final FeatureHealthRepository repository=mock(FeatureHealthRepository.class);
    private final StoreRepository store=mock(StoreRepository.class);
    private final CurrentUserService users=mock(CurrentUserService.class);
    private final RuntimeService runtime=mock(RuntimeService.class);
    private final FeaturePermissionProbe permissions=mock(FeaturePermissionProbe.class);
    private final FeatureHealthService service=new FeatureHealthService(repository,store,users,runtime,permissions);
    private final UUID owner=UUID.randomUUID(),bot=UUID.randomUUID(),installation=UUID.randomUUID(),license=UUID.randomUUID();
    private void authorize() {
        when(users.getActiveAccount("subject")).thenReturn(new CurrentUserRepository.AccountProfile(owner,AppRole.USER,AccountStatus.ACTIVE,"user","User",null,null,null,null));
        when(store.botBelongsTo(bot,owner)).thenReturn(true);
    }
    private FeatureHealthRepository.Row row(String error,boolean runtimeActive) {
        return new FeatureHealthRepository.Row(installation,license,owner,"ERROR",error,"required",null,null,0,null,"bot-presence","Presence","1.0.0","ACTIVE",null,"RUNNING",null,runtimeActive);
    }
    @Test void crossOwnerCannotInspectOrProbeBot() {
        authorize();when(store.botBelongsTo(bot,owner)).thenReturn(false);
        assertThatThrownBy(()->service.list("subject",bot)).isInstanceOf(StoreNotFoundException.class);
        assertThatThrownBy(()->service.retry("subject",bot,installation)).isInstanceOf(StoreNotFoundException.class);
        verifyNoInteractions(repository,permissions,runtime);
    }
    @Test void neverRetriesOperationErrorsOrExpiredRuntime() {
        authorize();
        for (var candidate:List.of(row("PAYMENT_FAILED",true),row("FEATURE_ACTIVATION_FAILED",false))) {
            when(repository.list(bot)).thenReturn(List.of(candidate));
            assertThatThrownBy(()->service.retry("subject",bot,installation)).isInstanceOf(StoreConflictException.class);
        }
        verifyNoInteractions(permissions,runtime);
        verify(repository,never()).retry(any(),any(),any());
    }
    @Test void checksConfigurationAndPermissionsBeforeConditionalTransition() {
        authorize();when(repository.list(bot)).thenReturn(List.of(row("FEATURE_ACTIVATION_FAILED",true)));
        var context=new StoreRepository.LicenseContext(license,UUID.randomUUID(),UUID.randomUUID(),"ACTIVE",null,UUID.randomUUID(),0,null);
        when(store.findLicense(license,owner)).thenReturn(Optional.of(context));
        when(store.findConfiguration(context)).thenReturn(new FeatureConfigurationResponse(license,0,bot,List.of(),List.of()));
        when(repository.retry(bot,installation,owner)).thenReturn(true);
        service.retry("subject",bot,installation);
        var ordered=inOrder(permissions,repository,runtime);
        ordered.verify(permissions).check(bot,null,"bot-presence",Map.of());
        ordered.verify(repository).retry(bot,installation,owner);
        ordered.verify(runtime).invalidateBootstrap();
    }
    @Test void failedProbeDoesNotChangeStatusOrInvalidateCache() {
        authorize();when(repository.list(bot)).thenReturn(List.of(row("FEATURE_ACTIVATION_FAILED",true)));
        var context=new StoreRepository.LicenseContext(license,UUID.randomUUID(),UUID.randomUUID(),"ACTIVE",null,UUID.randomUUID(),0,null);
        when(store.findLicense(license,owner)).thenReturn(Optional.of(context));
        doThrow(new StoreValidationException("Missing permissions")).when(permissions).check(bot,null,"bot-presence",Map.of());
        assertThatThrownBy(()->service.retry("subject",bot,installation)).hasMessageContaining("permissions");
        verify(repository,never()).retry(any(),any(),any());verifyNoInteractions(runtime);
    }
    @Test void crossBotInstallationCannotBeRetriedEvenByAdmin() {
        when(repository.botExists(bot)).thenReturn(true);when(repository.list(bot)).thenReturn(List.of());
        assertThatThrownBy(()->service.retryAsAdmin(bot,installation)).isInstanceOf(StoreNotFoundException.class);
        verifyNoInteractions(permissions,runtime);
    }
}
