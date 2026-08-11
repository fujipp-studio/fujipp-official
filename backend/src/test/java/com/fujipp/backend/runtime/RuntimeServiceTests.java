package com.fujipp.backend.runtime;

import com.fujipp.backend.store.StoreSecretCipher;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RuntimeServiceTests {

    private final RuntimeRepository repository = mock(RuntimeRepository.class);
    private final RuntimeService service = new RuntimeService(
            repository,
            mock(StoreSecretCipher.class),
            JsonMapper.builder().build(),
            java.time.Duration.ofSeconds(60)
    );
    private final JsonMapper json = JsonMapper.builder().build();

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
