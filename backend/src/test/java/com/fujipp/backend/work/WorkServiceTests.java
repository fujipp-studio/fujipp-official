package com.fujipp.backend.work;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WorkServiceTests {

    private final WorkRepository repository = mock(WorkRepository.class);
    private final WorkService service = new WorkService(repository);

    @Test
    void normalizesCategoryFilter() {
        when(repository.findPublished("en", "web-app", true)).thenReturn(List.of());

        service.listPublished(WorkLocale.en, "  Web-App  ", true);

        verify(repository).findPublished("en", "web-app", true);
    }

    @Test
    void treatsBlankCategoryAsNoFilter() {
        when(repository.findPublished("th", null, null)).thenReturn(List.of());

        service.listPublished(WorkLocale.th, " ", null);

        verify(repository).findPublished("th", null, null);
    }

    @Test
    void normalizesDetailSlug() {
        when(repository.findPublishedBySlug("my-project", "th"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPublished("  My-Project  ", WorkLocale.th))
                .isInstanceOf(WorkNotFoundException.class);
        verify(repository).findPublishedBySlug("my-project", "th");
    }
}
