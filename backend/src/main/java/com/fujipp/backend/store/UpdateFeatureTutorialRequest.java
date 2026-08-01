package com.fujipp.backend.store;

import jakarta.validation.constraints.Size;

public record UpdateFeatureTutorialRequest(@Size(max = 500) String tutorialUrl) {
}
