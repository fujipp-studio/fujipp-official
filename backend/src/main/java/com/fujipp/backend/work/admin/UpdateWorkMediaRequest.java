package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record UpdateWorkMediaRequest(
        @Size(max = 255) String altText,
        @Positive int sortOrder
) {
}
