package com.fujipp.backend.auth;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminFeatureGrantTests {
    @Test
    void grantCreatesTheConfigSetRequiredToInstallTheLicense() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        UUID userId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        UUID licenseId = UUID.randomUUID();
        var request = new AdminUserRequests.GrantFeatureRequest(productId, 1, null);
        when(jdbc.queryForObject(contains("INSERT INTO private.feature_licenses"), eq(UUID.class),
                eq(userId), eq(1), eq(adminId), eq(null), eq(productId), eq(userId)))
                .thenReturn(licenseId);

        assertThat(new AdminUserRepository(jdbc).grantFeature(userId, request, adminId))
                .isEqualTo(licenseId);
        verify(jdbc).update(contains("INSERT INTO private.feature_config_sets"), eq(licenseId));
    }
}
