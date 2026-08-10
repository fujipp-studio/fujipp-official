package com.fujipp.backend.runtime;

import java.util.List;

public record RuntimeAvailabilityResponse(
        int totalSlots, int usedSlots, int availableSlots, List<Slot> slots
) {
    public record Slot(int slotNumber, String occupancy) {}
}
