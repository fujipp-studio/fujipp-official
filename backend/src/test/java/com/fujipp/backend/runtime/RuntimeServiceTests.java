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
            java.time.Duration.ofSeconds(60)
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

    private RuntimeStateRequest request(tools.jackson.databind.JsonNode state) {
        return new RuntimeStateRequest(UUID.randomUUID(), UUID.randomUUID(), state);
    }
}
