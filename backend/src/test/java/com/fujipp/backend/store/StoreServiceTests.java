package com.fujipp.backend.store;

import com.fujipp.backend.auth.AccountStatus;
import com.fujipp.backend.auth.AppRole;
import com.fujipp.backend.auth.CurrentUserRepository;
import com.fujipp.backend.auth.CurrentUserService;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StoreServiceTests {

    private final StoreRepository repository = mock(StoreRepository.class);
    private final CurrentUserService currentUserService = mock(CurrentUserService.class);
    private final StoreSecretCipher secretCipher = mock(StoreSecretCipher.class);
    private final StoreService service = new StoreService(
            repository,
            currentUserService,
            secretCipher
    );

    @Test
    void checkoutDebitsWalletAndIssuesLicensesOnce() {
        UUID userId = UUID.randomUUID();
        UUID offerId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID itemId = UUID.randomUUID();
        UUID walletId = UUID.randomUUID();
        UUID entryId = UUID.randomUUID();
        UUID licenseOne = UUID.randomUUID();
        UUID licenseTwo = UUID.randomUUID();
        OffsetDateTime paidAt = OffsetDateTime.now();
        CheckoutRequest request = new CheckoutRequest(offerId, 2, "checkout-key");
        StoreRepository.OfferCheckoutRow offer = new StoreRepository.OfferCheckoutRow(
                offerId, productId, versionId, "welcome", "Welcome", "permanent",
                "Permanent", "ONE_TIME", 15000, "THB", null, 1
        );
        StoreRepository.OrderContext order = new StoreRepository.OrderContext(
                orderId, itemId, "ORD_TEST", walletId, 30000
        );
        authorize(userId);
        when(repository.findOrderByIdempotency(userId, "checkout-key"))
                .thenReturn(Optional.empty());
        when(repository.findOfferForCheckout(offerId)).thenReturn(Optional.of(offer));
        when(repository.createPendingOrder(userId, offer, 2, "checkout-key"))
                .thenReturn(order);
        when(repository.debitOrder(order, "checkout-key")).thenReturn(entryId);
        when(repository.markOrderPaid(orderId, entryId)).thenReturn(paidAt);
        when(repository.issueLicenses(userId, offer, order, 2, paidAt))
                .thenReturn(List.of(licenseOne, licenseTwo));

        OrderResponse response = service.checkout(userId.toString(), request);

        verify(repository).lockCheckout("checkout-key");
        verify(repository).debitOrder(order, "checkout-key");
        assertThat(response.status()).isEqualTo("PAID");
        assertThat(response.totalSatang()).isEqualTo(30000);
        assertThat(response.licenseIds()).containsExactly(licenseOne, licenseTwo);
    }

    @Test
    void idempotencyReplayMustMatchOriginalCheckout() {
        UUID userId = UUID.randomUUID();
        UUID firstOfferId = UUID.randomUUID();
        UUID secondOfferId = UUID.randomUUID();
        authorize(userId);
        OrderResponse existing = new OrderResponse(
                UUID.randomUUID(), "ORD_TEST", "PAID", 10000, "THB",
                OffsetDateTime.now(), List.of(UUID.randomUUID())
        );
        when(repository.findOrderByIdempotency(userId, "same-key"))
                .thenReturn(Optional.of(new StoreRepository.OrderReplay(
                        existing,
                        firstOfferId,
                        1
                )));

        assertThatThrownBy(() -> service.checkout(
                userId.toString(),
                new CheckoutRequest(secondOfferId, 1, "same-key")
        )).isInstanceOf(StoreConflictException.class);

        verify(repository, never()).debitOrder(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.anyString()
        );
    }

    @Test
    void installingFeatureClearsPreviousBotValidation() {
        UUID userId = UUID.randomUUID();
        UUID licenseId = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        UUID configSetId = UUID.randomUUID();
        UUID botId = UUID.randomUUID();
        UUID installationId = UUID.randomUUID();
        authorize(userId);
        StoreRepository.LicenseContext license = new StoreRepository.LicenseContext(
                licenseId, productId, versionId, "ACTIVE", null,
                configSetId, 2, UUID.randomUUID()
        );
        when(repository.findLicense(licenseId, userId)).thenReturn(Optional.of(license));
        when(repository.botBelongsTo(botId, userId)).thenReturn(true);
        when(repository.installFeature(license, userId, botId)).thenReturn(installationId);

        UUID result = service.install(
                userId.toString(),
                licenseId,
                new InstallFeatureRequest(botId)
        );

        assertThat(result).isEqualTo(installationId);
        verify(repository).clearConfigValidation(configSetId);
    }

    @Test
    void rejectsConfigValueWithWrongJsonType() {
        UUID userId = UUID.randomUUID();
        UUID licenseId = UUID.randomUUID();
        UUID versionId = UUID.randomUUID();
        authorize(userId);
        StoreRepository.LicenseContext license = new StoreRepository.LicenseContext(
                licenseId, UUID.randomUUID(), versionId, "ACTIVE", null,
                UUID.randomUUID(), 0, null
        );
        StoreRepository.ConfigDefinition definition = new StoreRepository.ConfigDefinition(
                UUID.randomUUID(), "CHANNEL_ID", "CHANNEL_ID", false
        );
        JsonNode nonTextValue = mock(JsonNode.class);
        when(nonTextValue.isNull()).thenReturn(false);
        when(nonTextValue.isTextual()).thenReturn(false);
        when(repository.findLicense(licenseId, userId)).thenReturn(Optional.of(license));
        when(repository.findConfigDefinitions(versionId)).thenReturn(List.of(definition));

        assertThatThrownBy(() -> service.updateConfiguration(
                userId.toString(),
                licenseId,
                new UpdateFeatureConfigurationRequest(
                        Map.of("CHANNEL_ID", nonTextValue),
                        Map.of(),
                        Map.of()
                )
        )).isInstanceOf(StoreValidationException.class);

        verify(repository, never()).upsertConfigValue(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    private void authorize(UUID userId) {
        when(currentUserService.getActiveAccount(userId.toString()))
                .thenReturn(new CurrentUserRepository.AccountProfile(
                        userId,
                        AppRole.USER,
                        AccountStatus.ACTIVE,
                        "user",
                        "User",
                        null,
                        null,
                        null,
                        null
                ));
    }
}
