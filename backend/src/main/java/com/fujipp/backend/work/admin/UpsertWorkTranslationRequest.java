package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpsertWorkTranslationRequest(
        @NotBlank @Size(max = 100) String name,
        @NotBlank @Size(max = 120) String shortDescription,
        @NotBlank @Size(max = 2000) String overview,
        @NotBlank @Size(max = 2000) String feasibility,
        @NotBlank @Size(max = 2000) String targetUsers
) {
}
