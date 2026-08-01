package com.fujipp.backend.store;

import java.util.List;
import java.util.UUID;

public record FeatureSummaryResponse(
        UUID id,
        String code,
        String name,
        String description,
        String category,
        String iconKey,
        ImageResponse image,
        String tutorialUrl,
        boolean featured,
        String version,
        List<OfferResponse> offers
) {
    public record ImageResponse(
            String url,
            Integer width,
            Integer height,
            String format,
            Long bytes,
            String altText
    ) {
    }

    public record OfferResponse(
            UUID id,
            String code,
            String name,
            String kind,
            long priceSatang,
            String currency,
            Integer billingPeriodDays,
            int installationLimit
    ) {
    }
}
