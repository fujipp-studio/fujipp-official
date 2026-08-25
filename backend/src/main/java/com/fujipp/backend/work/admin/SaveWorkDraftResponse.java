package com.fujipp.backend.work.admin;

import java.util.List;

public record SaveWorkDraftResponse(
        AdminWorkResponse work,
        List<AdminWorkContentResponse> content,
        List<AdminWorkLinkResponse> links
) {
}
