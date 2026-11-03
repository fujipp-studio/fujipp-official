package com.fujipp.backend.store;

import java.time.OffsetDateTime;
import java.util.UUID;

public record FeatureHealthResponse(UUID installationId, UUID licenseId, String featureCode, String featureName,
        String version, String status, String errorCategory, String errorCode, String errorMessage, String hint,
        OffsetDateTime lastErrorAt, int recoveryAttempts, OffsetDateTime nextRetryAt, boolean canRetry) {}
