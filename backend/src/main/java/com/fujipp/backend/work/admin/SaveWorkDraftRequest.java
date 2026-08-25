package com.fujipp.backend.work.admin;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record SaveWorkDraftRequest(
        @NotNull @Valid UpdateWorkRequest work,
        @NotNull @Valid UpsertWorkTranslationRequest en,
        @NotNull @Valid UpsertWorkTranslationRequest th,
        @NotNull @Valid OrderedCodesRequest positions,
        @NotNull @Valid OrderedCodesRequest technologies,
        @NotNull @Size(max = 100) List<@Valid Content> content,
        @NotNull @Size(max = 20) List<@Valid Link> links
) {
    public record Content(
            UUID id,
            @NotNull WorkContentType type,
            @PositiveOrZero int sortOrder,
            @NotNull @Valid UpsertContentTranslationRequest en,
            @NotNull @Valid UpsertContentTranslationRequest th
    ) {
    }

    public record Link(
            UUID id,
            @NotNull @Valid UpsertWorkLinkRequest value
    ) {
    }
}
