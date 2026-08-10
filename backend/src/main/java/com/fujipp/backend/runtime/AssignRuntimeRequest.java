package com.fujipp.backend.runtime;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record AssignRuntimeRequest(@NotNull UUID botId) {}
