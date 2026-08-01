package com.fujipp.backend.store;

import java.time.OffsetDateTime;
import java.util.UUID;

public record BotResponse(
        UUID id,
        String name,
        String discordApplicationId,
        String discordGuildId,
        String discordUsername,
        String discordAvatarUrl,
        String status,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
