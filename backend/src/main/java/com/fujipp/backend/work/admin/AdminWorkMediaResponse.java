package com.fujipp.backend.work.admin;

import java.util.UUID;

public record AdminWorkMediaResponse(
        UUID id,
        String type,
        String url,
        Integer width,
        Integer height,
        String format,
        Long bytes,
        String altText,
        int sortOrder
) {
}
