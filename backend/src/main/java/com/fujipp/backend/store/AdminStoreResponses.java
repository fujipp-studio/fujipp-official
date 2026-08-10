package com.fujipp.backend.store;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public final class AdminStoreResponses {
    private AdminStoreResponses() {}

    public record Feature(
            UUID id, String code, String name, String description, String category,
            String iconKey, String imageUrl, String imageAltText, String tutorialUrl,
            String status, boolean featured, int sortOrder, String latestVersion,
            String versionStatus, OffsetDateTime publishedAt, List<Offer> offers
    ) {}

    public record Offer(
            UUID id, String code, String name, String kind, long priceSatang,
            String currency, Integer billingPeriodDays, int installationLimit,
            boolean active, OffsetDateTime startsAt, OffsetDateTime endsAt
    ) {}

    public record Bot(
            UUID id, UUID ownerUserId, String ownerDisplayName, String name,
            String status, String desiredState, OffsetDateTime createdAt
    ) {}
}
