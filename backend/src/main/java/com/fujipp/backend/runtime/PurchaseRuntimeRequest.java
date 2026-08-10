package com.fujipp.backend.runtime;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PurchaseRuntimeRequest(@NotNull UUID planId) {}
