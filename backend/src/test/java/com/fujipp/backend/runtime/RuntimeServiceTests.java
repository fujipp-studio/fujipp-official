package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreSecretCipher;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

class RuntimeServiceTests {

    private final RuntimeRepository repository = mock(RuntimeRepository.class);
    private final RuntimeService service = new RuntimeService(
            repository,
            mock(StoreSecretCipher.class),
            JsonMapper.builder().build(),
            new io.micrometer.core.instrument.simple.SimpleMeterRegistry(),
            java.time.Duration.ofSeconds(60),
            java.time.Duration.ofMinutes(5)
    );
    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void bulkLoadsBootstrapOnceAndServesSubsequentCallsFromCache() {
        UUID botId=UUID.randomUUID(),configId=UUID.randomUUID(),installationId=UUID.randomUUID();
        when(repository.findRunnableBots()).thenReturn(List.of(new RuntimeRepository.BotRow(
                botId,"Bot","123456789012345","123456789012346",1,UUID.randomUUID(),
                OffsetDateTime.now().plusDays(1),true,new byte[]{1},new byte[]{2},"v1")));
        when(repository.findFeatures(List.of(botId))).thenReturn(List.of(new RuntimeRepository.FeatureRow(
                installationId,botId,"feature","1.0.0","feature",configId,2,Map.of())));
        when(repository.findConfig(List.of(configId))).thenReturn(Map.of(configId,Map.of()));
        when(repository.findSecrets(List.of(configId))).thenReturn(List.of());
        when(repository.findPresentations(List.of(configId))).thenReturn(Map.of(configId,Map.of()));

        service.bootstrap();
        service.bootstrap();

        verify(repository,times(1)).findRunnableBots();
        verify(repository,times(1)).findFeatures(List.of(botId));
        verify(repository,times(1)).findConfig(List.of(configId));
        verify(repository,times(1)).findSecrets(List.of(configId));
        verify(repository,times(1)).findPresentations(List.of(configId));
    }

    @Test
    void savesSmallObjectStateForAnActiveInstallation() {
        RuntimeStateRequest request = request(json.createObjectNode().put("channelId", "123"));
        when(repository.upsertState(request)).thenReturn(true);

        service.updateState(request);

        verify(repository).upsertState(request);
    }

    @Test
    void rejectsNonObjectState() {
        RuntimeStateRequest request = request(json.getNodeFactory().textNode("invalid"));

        assertThatThrownBy(() -> service.updateState(request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> org.assertj.core.api.Assertions.assertThat(
                        ((ResponseStatusException) error).getStatusCode()
                ).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void rejectsUnknownOrInactiveInstallation() {
        RuntimeStateRequest request = request(json.createObjectNode());
        when(repository.upsertState(request)).thenReturn(false);

        assertThatThrownBy(() -> service.updateState(request))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> org.assertj.core.api.Assertions.assertThat(
                        ((ResponseStatusException) error).getStatusCode()
                ).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    void refreshesStateWithoutReloadingUnchangedFeaturePayload() {
        UUID botId = UUID.randomUUID(), configId = UUID.randomUUID(), installationId = UUID.randomUUID();
        mockFeature(botId, configId, installationId, 2, Map.of());
        service.bootstrap();
        var state = request(json.createObjectNode().put("messageId", "new"));
        when(repository.upsertState(state)).thenReturn(true);
        service.updateState(state);
        mockFeature(botId, configId, installationId, 2, Map.of("messageId", json.getNodeFactory().textNode("new")));

        var response = service.bootstrap().response();

        org.assertj.core.api.Assertions.assertThat(response.bots().getFirst().features().getFirst().runtimeState())
                .containsKey("messageId");
        verify(repository, times(2)).findRunnableBots();
        verify(repository, times(1)).findConfig(List.of(configId));
        verify(repository, times(1)).findPresentations(List.of(configId));
        verify(repository, times(1)).findSecrets(List.of(configId));
    }

    @Test
    void reloadsChangedRevisionAndExplicitlyInvalidatedConfiguration() {
        UUID botId = UUID.randomUUID(), configId = UUID.randomUUID(), installationId = UUID.randomUUID();
        mockFeature(botId, configId, installationId, 2, Map.of());
        service.bootstrap();
        var state = request(json.createObjectNode());
        when(repository.upsertState(state)).thenReturn(true);
        service.updateState(state);
        mockFeature(botId, configId, installationId, 3, Map.of());
        org.assertj.core.api.Assertions.assertThat(service.bootstrap().response().bots().getFirst()
                .features().getFirst().configRevision()).isEqualTo(3);
        verify(repository, times(2)).findConfig(List.of(configId));
        service.invalidateBootstrap();
        service.bootstrap();
        verify(repository, times(3)).findConfig(List.of(configId));
    }

    @Test
    void removesInactiveFeaturesEvenWhenTheirConfigurationIsCached() {
        UUID botId = UUID.randomUUID(), configId = UUID.randomUUID(), installationId = UUID.randomUUID();
        mockFeature(botId, configId, installationId, 2, Map.of());
        service.bootstrap();
        var state = request(json.createObjectNode());
        when(repository.upsertState(state)).thenReturn(true);
        service.updateState(state);
        when(repository.findFeatures(List.of(botId))).thenReturn(List.of());
        org.assertj.core.api.Assertions.assertThat(service.bootstrap().response().bots().getFirst().features()).isEmpty();
        mockFeature(botId, configId, installationId, 2, Map.of());
        service.updateState(state);
        service.bootstrap();
        verify(repository, times(2)).findConfig(List.of(configId));
    }

    @Test
    void expiresFeaturePayloadCacheEvenWithoutRevisionChanges() {
        UUID botId = UUID.randomUUID(), configId = UUID.randomUUID(), installationId = UUID.randomUUID();
        mockFeature(botId, configId, installationId, 2, Map.of());
        var uncached = new RuntimeService(repository, mock(StoreSecretCipher.class), json,
                new io.micrometer.core.instrument.simple.SimpleMeterRegistry(),
                java.time.Duration.ZERO, java.time.Duration.ZERO);
        uncached.bootstrap();
        uncached.bootstrap();
        verify(repository, times(2)).findConfig(List.of(configId));
    }

    @Test
    void reloadsOnlyTheFeatureWhoseRevisionChanged() {
        UUID botId = UUID.randomUUID(), first = UUID.randomUUID(), second = UUID.randomUUID();
        mockFeature(botId, first, UUID.randomUUID(), 1, Map.of());
        UUID firstInstallation = UUID.randomUUID(), secondInstallation = UUID.randomUUID();
        var unchanged = new RuntimeRepository.FeatureRow(secondInstallation, botId, "second", "1.0.0", "second", second, 1, Map.of());
        when(repository.findFeatures(List.of(botId))).thenReturn(List.of(
                new RuntimeRepository.FeatureRow(firstInstallation, botId, "first", "1.0.0", "first", first, 1, Map.of()), unchanged));
        when(repository.findConfig(List.of(first, second))).thenReturn(Map.of(first, Map.of(), second, Map.of()));
        when(repository.findSecrets(List.of(first, second))).thenReturn(List.of());
        when(repository.findPresentations(List.of(first, second))).thenReturn(Map.of());
        service.bootstrap();
        var state = request(json.createObjectNode());
        when(repository.upsertState(state)).thenReturn(true);
        service.updateState(state);
        when(repository.findFeatures(List.of(botId))).thenReturn(List.of(
                new RuntimeRepository.FeatureRow(firstInstallation, botId, "first", "1.0.0", "first", first, 2, Map.of()), unchanged));
        org.assertj.core.api.Assertions.assertThat(service.bootstrap().response().bots().getFirst().features()).hasSize(2);
        verify(repository).findConfig(List.of(first, second));
        verify(repository).findConfig(List.of(first));
        verify(repository, org.mockito.Mockito.never()).findConfig(List.of(second));
    }

    private void mockFeature(UUID botId, UUID configId, UUID installationId, long revision,
            Map<String, tools.jackson.databind.JsonNode> state) {
        when(repository.findRunnableBots()).thenReturn(List.of(new RuntimeRepository.BotRow(
                botId, "Bot", "123456789012345", "123456789012346", 1, UUID.randomUUID(),
                OffsetDateTime.now().plusDays(1), true, new byte[]{1}, new byte[]{2}, "v1")));
        when(repository.findFeatures(List.of(botId))).thenReturn(List.of(new RuntimeRepository.FeatureRow(
                installationId, botId, "feature", "1.0.0", "feature", configId, revision, state)));
        when(repository.findConfig(List.of(configId))).thenReturn(Map.of(configId, Map.of()));
        when(repository.findSecrets(List.of(configId))).thenReturn(List.of());
        when(repository.findPresentations(List.of(configId))).thenReturn(Map.of(configId, Map.of()));
    }

    private RuntimeStateRequest request(tools.jackson.databind.JsonNode state) {
        return new RuntimeStateRequest(UUID.randomUUID(), UUID.randomUUID(), state);
    }
}
