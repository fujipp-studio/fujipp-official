package com.fujipp.backend.store;

public record FeatureMediaResponse(
        String url,
        Integer width,
        Integer height,
        String format,
        Long bytes,
        String altText,
        String tutorialUrl
) {
    static FeatureMediaResponse from(StoreRepository.FeatureAdminMedia media) {
        return new FeatureMediaResponse(
                media.url(),
                media.width(),
                media.height(),
                media.format(),
                media.bytes(),
                media.altText(),
                media.tutorialUrl()
        );
    }
}
