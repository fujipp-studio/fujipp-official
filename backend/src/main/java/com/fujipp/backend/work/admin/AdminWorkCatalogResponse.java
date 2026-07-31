package com.fujipp.backend.work.admin;

import java.util.List;

public record AdminWorkCatalogResponse(
        List<Category> categories,
        List<Position> positions,
        List<Technology> technologies
) {
    public record Category(String code, String name) {}
    public record Position(String code, String name) {}
    public record Technology(String slug, String name, String groupCode, String groupName) {}
}
