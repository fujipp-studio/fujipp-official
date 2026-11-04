package com.fujipp.backend.store;

import jakarta.validation.constraints.NotNull;

public record SetFeatureEnabledRequest(@NotNull Boolean enabled) {}
