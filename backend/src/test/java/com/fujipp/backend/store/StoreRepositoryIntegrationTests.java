package com.fujipp.backend.store;

import com.fujipp.backend.runtime.RuntimeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.json.JsonMapper;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(named = "STORE_INTEGRATION_TESTS", matches = "true")
class StoreRepositoryIntegrationTests {

    @Test
    void completesCatalogCheckoutInstallAndConfigurationFlow() {
        String databaseUrl = System.getenv().getOrDefault(
                "STORE_TEST_DB_URL",
                "jdbc:postgresql://127.0.0.1:55432/postgres"
        );
        JdbcTemplate jdbc = new JdbcTemplate(new DriverManagerDataSource(
                databaseUrl,
                "postgres",
                "postgres"
        ));
        StoreRepository repository = new StoreRepository(
                jdbc,
                JsonMapper.builder().build()
        );

        UUID userId = UUID.randomUUID();
        jdbc.update("INSERT INTO auth.users (id) VALUES (?)", userId);

        UUID productId = jdbc.queryForObject(
                """
                INSERT INTO shop.feature_products (code, name, category, status)
                VALUES ('integration-feature', 'Integration Feature', 'TEST', 'ACTIVE')
                RETURNING id
                """,
                UUID.class
        );
        UUID versionId = jdbc.queryForObject(
                """
                INSERT INTO shop.feature_versions (
                    feature_product_id, version, runtime_key, status, published_at
                ) VALUES (?, '1.0.0', 'integration-feature', 'PUBLISHED', now())
                RETURNING id
                """,
                UUID.class,
                productId
        );
        UUID offerId = jdbc.queryForObject(
                """
                INSERT INTO shop.feature_offers (
                    feature_product_id, code, name, offer_kind, price_satang
                ) VALUES (?, 'permanent', 'Permanent', 'ONE_TIME', 12500)
                RETURNING id
                """,
                UUID.class,
                productId
        );
        UUID definitionId = jdbc.queryForObject(
                """
                INSERT INTO shop.feature_config_definitions (
                    feature_version_id, config_key, label, value_type
                ) VALUES (?, 'WELCOME_TEXT', 'Welcome text', 'TEXT')
                RETURNING id
                """,
                UUID.class,
                versionId
        );

        assertThat(repository.findActiveFeatures())
                .singleElement()
                .satisfies(feature -> {
                    assertThat(feature.code()).isEqualTo("integration-feature");
                    assertThat(feature.offers()).singleElement()
                            .extracting(FeatureSummaryResponse.OfferResponse::priceSatang)
                            .isEqualTo(12500L);
                });

        BotResponse bot = repository.createBot(userId, "Integration Bot", null, null);
        assertThat(repository.botBelongsTo(bot.id(), userId)).isTrue();

        UUID walletId = jdbc.queryForObject(
                """
                SELECT wallet.id
                  FROM billing.wallets AS wallet
                  JOIN billing.customers AS customer
                    ON customer.id = wallet.customer_id
                 WHERE customer.user_id = ?
                """,
                UUID.class,
                userId
        );
        jdbc.queryForObject(
                """
                SELECT entry.id
                  FROM billing.apply_wallet_entry(
                        ?, 'CREDIT', 'ADJUSTMENT', 12500, 'store-integration-credit'
                  ) AS entry
                """,
                UUID.class,
                walletId
        );

        StoreRepository.OfferCheckoutRow offer = repository.findOfferForCheckout(offerId)
                .orElseThrow();
        repository.lockCheckout("store-integration-order");
        StoreRepository.OrderContext order = repository.createPendingOrder(
                userId,
                offer,
                1,
                "store-integration-order"
        );
        UUID debitId = repository.debitOrder(order, "store-integration-order");
        OffsetDateTime paidAt = repository.markOrderPaid(order.orderId(), debitId);
        UUID licenseId = repository.issueLicenses(
                userId,
                offer,
                order,
                1,
                paidAt
        ).getFirst();

        assertThat(repository.findOrderByIdempotency(userId, "store-integration-order"))
                .hasValueSatisfying(replay -> {
                    assertThat(replay.offerId()).isEqualTo(offerId);
                    assertThat(replay.quantity()).isEqualTo(1);
                    assertThat(replay.response().licenseIds()).containsExactly(licenseId);
                });

        assertThat(repository.findLicenses(userId))
                .singleElement()
                .extracting(LicenseResponse::id)
                .isEqualTo(licenseId);

        StoreRepository.LicenseContext license = repository.findLicense(licenseId, userId)
                .orElseThrow();
        UUID installationId = repository.installFeature(license, userId, bot.id());
        assertThat(installationId).isNotNull();

        repository.upsertConfigValue(
                license,
                definitionId,
                JsonMapper.builder().build().getNodeFactory().textNode("Hello")
        );
        repository.bumpConfigRevision(license.configSetId());

        FeatureConfigurationResponse configuration = repository.findConfiguration(
                repository.findLicense(licenseId, userId).orElseThrow()
        );
        assertThat(configuration.revision()).isEqualTo(1);
        assertThat(configuration.fields())
                .singleElement()
                .satisfies(field -> {
                    assertThat(field.key()).isEqualTo("WELCOME_TEXT");
                    assertThat(field.value().stringValue()).isEqualTo("Hello");
                });

        StoreSecretCipher cipher = new StoreSecretCipher(
                Base64.getEncoder().encodeToString(new byte[32]),
                "test-v1"
        );
        repository.upsertBotCredential(
                bot.id(), userId, "DISCORD_TOKEN", cipher.encrypt("discord-token")
        );
        RuntimeRepository runtimeRepository = new RuntimeRepository(
                jdbc,
                JsonMapper.builder().build()
        );
        RuntimeRepository.BotRow runtimeBot = runtimeRepository.findRunnableBots().stream()
                .filter(row -> row.id().equals(bot.id()))
                .findFirst()
                .orElseThrow();
        assertThat(cipher.decrypt(
                runtimeBot.ciphertext(), runtimeBot.nonce(), runtimeBot.keyVersion()
        )).isEqualTo("discord-token");
        assertThat(runtimeRepository.findFeatures(bot.id()))
                .singleElement()
                .satisfies(feature -> {
                    assertThat(feature.runtimeKey()).isEqualTo("integration-feature");
                    assertThat(runtimeRepository.findConfig(feature.configSetId()))
                            .containsEntry(
                                    "WELCOME_TEXT",
                                    JsonMapper.builder().build().getNodeFactory().textNode("Hello")
                            );
                });
    }
}
