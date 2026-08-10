package com.fujipp.backend.runtime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record RuntimeStatusRequest(
        @NotNull UUID botId,
        UUID installationId,
        @NotBlank @Size(max = 20) String status,
        @Size(max = 80) String errorCode,
        @Size(max = 2000) String errorMessage,
        @Size(max = 100) String discordUsername,
        @Size(max = 2048) String discordAvatarUrl
) {
    public RuntimeStatusRequest(
            UUID botId,
            UUID installationId,
            String status,
            String errorCode,
            String errorMessage
    ) {
        this(botId, installationId, status, errorCode, errorMessage, null, null);
    }
}
