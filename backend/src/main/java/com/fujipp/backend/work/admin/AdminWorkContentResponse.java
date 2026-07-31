package com.fujipp.backend.work.admin;

import java.util.List;
import java.util.UUID;

public record AdminWorkContentResponse(
        UUID id,
        String type,
        int sortOrder,
        List<Translation> translations
) {
    public record Translation(String locale, String title, String description) {
    }
}
