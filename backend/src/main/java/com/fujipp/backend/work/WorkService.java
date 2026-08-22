package com.fujipp.backend.work;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.pagination.CursorPage;

@Service
public class WorkService {

    private final WorkRepository workRepository;
    private final CursorCodec cursors;

    public WorkService(WorkRepository workRepository,CursorCodec cursors) {
        this.workRepository = workRepository;
        this.cursors = cursors;
    }

    @Transactional(readOnly = true)
    public CursorPage<WorkSummaryResponse> listPublishedV2(WorkLocale locale,String category,Boolean featured,
            int limit,String cursor) {
        String normalized=category==null||category.isBlank()?null:category.trim().toLowerCase(java.util.Locale.ROOT);
        String filter=locale.name()+"|"+(normalized==null?"":normalized)+"|"+(featured==null?"":featured);
        var values=cursors.decode(cursor,"works",filter,5);
        if(!values.isEmpty()) {
            cursors.integer(values.get(0));
            cursors.integer(values.get(1));
            cursors.decimal(values.get(2));
            cursors.uuid(values.get(4));
        }
        var rows=workRepository.findPublishedPage(locale.name(),normalized,featured,values,limit+1);
        var page=CursorPage.of(rows,limit,row->cursors.encode("works",filter,List.of(
                Integer.toString(row.featuredSort()),Integer.toString(row.featuredOrder()),
                row.publishedEpochSort(),row.slug(),row.id().toString())));
        return new CursorPage<>(page.items().stream().map(WorkRepository.WorkPageRow::item).toList(),page.nextCursor(),page.hasMore());
    }

    @Transactional(readOnly = true)
    public List<WorkSummaryResponse> listPublished(
            WorkLocale locale,
            String category,
            Boolean featured
    ) {
        String normalizedCategory = category == null || category.isBlank()
                ? null
                : category.trim().toLowerCase(java.util.Locale.ROOT);
        return workRepository.findPublished(locale.name(), normalizedCategory, featured);
    }

    @Transactional(readOnly = true)
    public WorkDetailResponse getPublished(String slug, WorkLocale locale) {
        String normalizedSlug = slug.trim().toLowerCase(java.util.Locale.ROOT);
        return workRepository.findPublishedBySlug(normalizedSlug, locale.name())
                .orElseThrow(WorkNotFoundException::new);
    }
}
