package com.fujipp.backend.runtime;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.json.JsonMapper;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class RuntimeFeatureRecoveryTests {
    private JdbcTemplate jdbc;
    private RuntimeRepository repository;
    private final UUID botId = UUID.randomUUID();

    @BeforeEach
    void database() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(
                "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=PostgreSQL;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.execute("CREATE SCHEMA shop");
        jdbc.execute("CREATE SCHEMA private");
        jdbc.execute("CREATE TABLE shop.feature_products (id UUID PRIMARY KEY, code VARCHAR)");
        jdbc.execute("CREATE TABLE shop.feature_versions (id UUID PRIMARY KEY, runtime_key VARCHAR, version VARCHAR)");
        jdbc.execute("CREATE TABLE private.feature_licenses (id UUID PRIMARY KEY, status VARCHAR, expires_at TIMESTAMP WITH TIME ZONE)");
        jdbc.execute("CREATE TABLE private.feature_config_sets (id UUID PRIMARY KEY, license_id UUID, revision BIGINT)");
        jdbc.execute("CREATE TABLE private.bot_feature_installations (id UUID PRIMARY KEY, bot_id UUID, feature_product_id UUID, feature_version_id UUID, license_id UUID, status VARCHAR, last_error_code VARCHAR, removed_at TIMESTAMP WITH TIME ZONE)");
        jdbc.execute("CREATE TABLE private.feature_runtime_states (installation_id UUID, state VARCHAR)");
        repository = new RuntimeRepository(jdbc, JsonMapper.builder().build());
    }

    @AfterEach
    void closeDatabase() {
        if (jdbc != null) jdbc.execute("SHUTDOWN");
    }

    record Scenario(String name, String code, String runtimeKey, String version, String status,
                    String errorCode, String licenseStatus, boolean expired, boolean removed,
                    boolean hasConfig, boolean anotherBot, boolean included) {
        @Override public String toString() { return name; }
    }

    static Stream<Scenario> scenarios() {
        return Stream.of(
                member("Neon startup DNS failure recovers", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, false, true),
                member("active installation stays runnable", "ACTIVE", null, "ACTIVE", false, false, true, false, true),
                member("new installation stays runnable", "INSTALLING", null, "ACTIVE", false, false, true, false, true),
                member("disabled installation stays excluded", "DISABLED", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, false, false),
                member("removed installation stays excluded", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, true, true, false, false),
                member("revoked license stays excluded", "ERROR", "FEATURE_ACTIVATION_FAILED", "REVOKED", false, false, true, false, false),
                member("expired license stays excluded", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", true, false, true, false, false),
                member("missing configuration stays excluded", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, false, false, false),
                member("another bot stays excluded", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, true, false),
                member("unrelated error stays excluded", "ERROR", "FEATURE_VERSION_NOT_BUNDLED", "ACTIVE", false, false, true, false, false),
                member("registration error stays excluded", "ERROR", "COMMAND_REGISTRATION_FAILED", "ACTIVE", false, false, true, false, false),
                new Scenario("different spending version stays excluded", "member-spending", "member-spending", "2.0.0", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, false, false),
                new Scenario("different runtime module stays excluded", "member-spending", "another-runtime", "1.0.0", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, false, false),
                new Scenario("other feature activation errors stay excluded", "shop-status", "shop-status", "1.0.0", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, false, false),
                new Scenario("legacy Message Sets send recovery remains", "message-sets", "message-sets", "1.0.0", "ERROR", "MESSAGE_SET_SEND_FAILED", "ACTIVE", false, false, true, false, true),
                new Scenario("legacy Message Sets acknowledgement recovery remains", "message-sets", "message-sets", "1.0.0", "ERROR", "MESSAGE_SET_ACK_FAILED", "ACTIVE", false, false, true, false, true),
                new Scenario("other Message Sets errors remain excluded", "message-sets", "message-sets", "1.0.0", "ERROR", "FEATURE_ACTIVATION_FAILED", "ACTIVE", false, false, true, false, false)
        );
    }

    private static Scenario member(String name, String status, String errorCode, String licenseStatus,
                                   boolean expired, boolean removed, boolean hasConfig, boolean anotherBot, boolean included) {
        return new Scenario(name, "member-spending", "member-spending", "1.0.0", status, errorCode,
                licenseStatus, expired, removed, hasConfig, anotherBot, included);
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("scenarios")
    void onlyEligibleInstallationsReachTheRunner(Scenario scenario) {
        UUID productId = UUID.randomUUID(), versionId = UUID.randomUUID(), licenseId = UUID.randomUUID();
        UUID installationId = UUID.randomUUID(), configId = UUID.randomUUID();
        jdbc.update("INSERT INTO shop.feature_products VALUES (?, ?)", productId, scenario.code());
        jdbc.update("INSERT INTO shop.feature_versions VALUES (?, ?, ?)", versionId, scenario.runtimeKey(), scenario.version());
        jdbc.update("INSERT INTO private.feature_licenses VALUES (?, ?, ?)", licenseId, scenario.licenseStatus(),
                scenario.expired() ? OffsetDateTime.now().minusDays(1) : null);
        if (scenario.hasConfig()) jdbc.update("INSERT INTO private.feature_config_sets VALUES (?, ?, ?)", configId, licenseId, 3);
        jdbc.update("INSERT INTO private.bot_feature_installations VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                installationId, scenario.anotherBot() ? UUID.randomUUID() : botId, productId, versionId, licenseId,
                scenario.status(), scenario.errorCode(), scenario.removed() ? OffsetDateTime.now() : null);

        var features = repository.findFeatures(List.of(botId));

        if (scenario.included()) {
            assertThat(features).singleElement().satisfies(feature -> {
                assertThat(feature.installationId()).isEqualTo(installationId);
                assertThat(feature.botId()).isEqualTo(botId);
                assertThat(feature.code()).isEqualTo(scenario.code());
                assertThat(feature.configSetId()).isEqualTo(configId);
            });
        } else assertThat(features).isEmpty();
    }
}
