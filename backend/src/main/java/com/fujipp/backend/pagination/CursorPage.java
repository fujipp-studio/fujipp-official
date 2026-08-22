package com.fujipp.backend.pagination;

import java.util.List;

public record CursorPage<T>(List<T> items, String nextCursor, boolean hasMore) {
    public static <T> CursorPage<T> of(List<T> rows, int limit, java.util.function.Function<T, String> cursor) {
        boolean hasMore = rows.size() > limit;
        List<T> items = List.copyOf(rows.subList(0, Math.min(limit, rows.size())));
        return new CursorPage<>(items, hasMore && !items.isEmpty() ? cursor.apply(items.getLast()) : null, hasMore);
    }
}
