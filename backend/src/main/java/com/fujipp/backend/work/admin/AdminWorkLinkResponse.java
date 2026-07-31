package com.fujipp.backend.work.admin;

import java.util.UUID;

public record AdminWorkLinkResponse(
        UUID id,
        String type,
        String label,
        String url,
        int sortOrder
) {
}
