package com.fujipp.backend.runtime;

import java.util.UUID;

public record RuntimePlanResponse(
        UUID id, String code, String name, int durationDays,
        long priceSatang, String currency
) {}
