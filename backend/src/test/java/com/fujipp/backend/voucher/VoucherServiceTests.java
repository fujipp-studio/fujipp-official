package com.fujipp.backend.voucher;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class VoucherServiceTests {

    private final VoucherRepository repository = mock(VoucherRepository.class);
    private final TrueMoneyVoucherAdapter adapter = mock(TrueMoneyVoucherAdapter.class);
    private final VoucherService service = new VoucherService(repository, adapter);

    @Test
    void storesAnExactPositiveAmountInSatang() {
        RedeemTrueMoneyVoucherRequest request = request();
        UUID redemptionId = UUID.randomUUID();
        VoucherRepository.RedemptionRow succeeded = row(
                redemptionId, request, VoucherStatus.SUCCEEDED, 5_000L, "fingerprint"
        );
        when(repository.findRecipientPhone(request.botId())).thenReturn(Optional.of("0812345678"));
        when(repository.claim(any(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.of(redemptionId));
        when(adapter.redeem("0812345678", request.giftUrl())).thenReturn(
                new TrueMoneyVoucherAdapter.Outcome(
                        new BigDecimal("50.00"), "Voucher Owner", "reference-1"
                )
        );
        when(repository.succeed(redemptionId, 5_000L, "Voucher Owner", "reference-1"))
                .thenReturn(succeeded);

        VoucherRedemptionResponse response = service.redeem(request);

        assertThat(response.status()).isEqualTo("SUCCEEDED");
        assertThat(response.amountSatang()).isEqualTo(5_000L);
        verify(repository).succeed(redemptionId, 5_000L, "Voucher Owner", "reference-1");
    }

    @Test
    void recordsZeroAmountAsAFailure() {
        RedeemTrueMoneyVoucherRequest request = request();
        UUID redemptionId = UUID.randomUUID();
        VoucherRepository.RedemptionRow failed = row(
                redemptionId, request, VoucherStatus.REDEEM_FAILED, null, "fingerprint"
        );
        when(repository.findRecipientPhone(request.botId())).thenReturn(Optional.of("0812345678"));
        when(repository.claim(any(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.of(redemptionId));
        when(adapter.redeem("0812345678", request.giftUrl())).thenReturn(
                new TrueMoneyVoucherAdapter.Outcome(BigDecimal.ZERO, "Voucher Owner", "reference-1")
        );
        when(repository.fail(
                redemptionId,
                VoucherStatus.REDEEM_FAILED,
                "UPSTREAM_INVALID_AMOUNT",
                "TrueMoney returned a non-positive amount"
        )).thenReturn(failed);

        VoucherRedemptionResponse response = service.redeem(request);

        assertThat(response.status()).isEqualTo("REDEEM_FAILED");
        assertThat(response.amountSatang()).isNull();
    }

    @Test
    void rejectsAnIdempotencyKeyReusedWithAnotherPayload() {
        RedeemTrueMoneyVoucherRequest request = request();
        VoucherRepository.RedemptionRow existing = row(
                UUID.randomUUID(), request, VoucherStatus.SUCCEEDED, 5_000L, "another-fingerprint"
        );
        when(repository.findRecipientPhone(request.botId())).thenReturn(Optional.of("0812345678"));
        when(repository.claim(any(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        when(repository.findByIdempotency(request.botId(), request.idempotencyKey()))
                .thenReturn(Optional.of(existing));

        assertThatThrownBy(() -> service.redeem(request))
                .isInstanceOf(VoucherConflictException.class)
                .hasMessageContaining("already been used");
    }

    @Test
    void requiresReconciliationWhenRedeemResultCannotBeConfirmed() {
        RedeemTrueMoneyVoucherRequest request = request();
        UUID redemptionId = UUID.randomUUID();
        VoucherRepository.RedemptionRow uncertain = row(
                redemptionId, request, VoucherStatus.RECONCILIATION_REQUIRED, null, "fingerprint"
        );
        when(repository.findRecipientPhone(request.botId())).thenReturn(Optional.of("0812345678"));
        when(repository.claim(any(), anyString(), anyString(), anyString()))
                .thenReturn(Optional.of(redemptionId));
        when(adapter.redeem("0812345678", request.giftUrl())).thenThrow(
                new VoucherException(
                        "REDEMPTION_OUTCOME_UNKNOWN",
                        "TrueMoney may have accepted this voucher"
                )
        );
        when(repository.fail(
                redemptionId,
                VoucherStatus.RECONCILIATION_REQUIRED,
                "REDEMPTION_OUTCOME_UNKNOWN",
                "TrueMoney may have accepted this voucher"
        )).thenReturn(uncertain);

        VoucherRedemptionResponse response = service.redeem(request);

        assertThat(response.status()).isEqualTo("RECONCILIATION_REQUIRED");
        verify(repository).fail(
                redemptionId,
                VoucherStatus.RECONCILIATION_REQUIRED,
                "REDEMPTION_OUTCOME_UNKNOWN",
                "TrueMoney may have accepted this voucher"
        );
    }

    private static RedeemTrueMoneyVoucherRequest request() {
        return new RedeemTrueMoneyVoucherRequest(
                UUID.randomUUID(),
                "1494842858132471980",
                "https://gift.truemoney.com/campaign/?v=testVoucher123",
                "voucher:test-001"
        );
    }

    private static VoucherRepository.RedemptionRow row(
            UUID id,
            RedeemTrueMoneyVoucherRequest request,
            VoucherStatus status,
            Long amountSatang,
            String fingerprint
    ) {
        OffsetDateTime now = OffsetDateTime.now();
        return new VoucherRepository.RedemptionRow(
                id,
                request.botId(),
                request.memberDiscordId(),
                fingerprint,
                status,
                amountSatang,
                "THB",
                "Voucher Owner",
                status == VoucherStatus.SUCCEEDED ? "reference-1" : null,
                status == VoucherStatus.REDEEM_FAILED ? "UPSTREAM_INVALID_AMOUNT" : null,
                status == VoucherStatus.REDEEM_FAILED ? "Invalid amount" : null,
                now.minusSeconds(1),
                status == VoucherStatus.REDEEMING ? null : now,
                now.minusSeconds(1)
        );
    }
}
