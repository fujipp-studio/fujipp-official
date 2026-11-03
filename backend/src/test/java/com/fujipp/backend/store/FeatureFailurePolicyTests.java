package com.fujipp.backend.store;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class FeatureFailurePolicyTests {
    @Test void classifiesLegacyRunnerMessagesAndHonorsExplicitCategory() {
        assertThat(FeatureFailurePolicy.category(null,"FEATURE_ACTIVATION_FAILED","REVIEW_CHANNEL_ID is required")).isEqualTo("CONFIGURATION");
        assertThat(FeatureFailurePolicy.category(null,"50013","Missing Permissions")).isEqualTo("PERMISSION");
        assertThat(FeatureFailurePolicy.category(null,"FEATURE_ACTIVATION_FAILED","fetch failed ECONNRESET")).isEqualTo("TRANSIENT");
        assertThat(FeatureFailurePolicy.category("INTERNAL","FAILED","fetch failed")).isEqualTo("INTERNAL");
        assertThat(FeatureFailurePolicy.category(null,null,null)).isNull();
        assertThat(FeatureFailurePolicy.category(null,"FAILED","Channel 150013429123456789 is required")).isEqualTo("CONFIGURATION");
    }
    @Test void removesCredentialsAndStackFromDiagnostics() {
        assertThat(FeatureFailurePolicy.safeMessage("failed AQ.synthetic-customer.gemini-key token=customer-secret https://example.test/?key=private\n    at private.file:12"))
            .doesNotContain("synthetic-customer","customer-secret","key=private","private.file").contains("[redacted]");
    }
}
