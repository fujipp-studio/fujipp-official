package com.fujipp.backend.store;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record InstallFeatureRequest(@NotNull UUID botId) {
}
