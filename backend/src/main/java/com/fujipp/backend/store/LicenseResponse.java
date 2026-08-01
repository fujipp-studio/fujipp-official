package com.fujipp.backend.store;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record LicenseResponse(
        UUID id,
        UUID featureProductId,
        String featureCode,
        String featureName,
        String version,
        String status,
        int installationLimit,
        OffsetDateTime acquiredAt,
        OffsetDateTime expiresAt,
        List<InstallationResponse> installations
) {
    public record InstallationResponse(
            UUID id,
            UUID botId,
            String botName,
            String status,
            OffsetDateTime installedAt
    ) {
    }
}
