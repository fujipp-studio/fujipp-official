package com.fujipp.backend.work.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record OrderedCodesRequest(
        @NotNull
        @Size(max = 50)
        List<
                @NotBlank
                @Size(max = 100)
                @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$")
                String
                > codes
) {
}
