package com.fujipp.backend.voucher;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.json.JsonMapper;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PaymentVoucherTests {
    private final VoucherRepository repository = mock(VoucherRepository.class);
    private final TrueMoneyVoucherAdapter adapter = mock(TrueMoneyVoucherAdapter.class);
    private final VoucherService service = new VoucherService(repository, adapter);
    private final UUID botId = UUID.randomUUID(), redemptionId = UUID.randomUUID();
    private final String messageId = "123456789012345678", phone = "0812345678";

    private RedeemTrueMoneyVoucherRequest request(String message, long amount) {
        return new RedeemTrueMoneyVoucherRequest(botId, "1494842858132471980",
                "https://gift.truemoney.com/campaign/?v=testVoucher123", "payment:test-001", message, amount);
    }
    private VoucherRepository.RedemptionRow row(String fingerprint, VoucherStatus status, Long amount) {
        var now = OffsetDateTime.now();
        return new VoucherRepository.RedemptionRow(redemptionId, botId, "1494842858132471980", fingerprint,
                status, amount, "THB", "Sender", "ref-1", null, null, now, now, now);
    }
    private void claim() {
        when(repository.findPaymentRecipientPhone(botId)).thenReturn(Optional.of(phone));
        when(repository.claim(any(), anyString(), anyString(), anyString())).thenReturn(Optional.of(redemptionId));
    }

    @Test void receivesExactInvoiceAmountUsingPaymentTriggerRecipientWithoutWalletTopup() {
        claim();
        var request = request(messageId, 10000);
        when(adapter.redeemPayment(phone, request.giftUrl(), 10000)).thenReturn(new TrueMoneyVoucherAdapter.Outcome(new BigDecimal("100.00"), "Sender", "ref-1"));
        when(repository.succeed(redemptionId, 10000, "Sender", "ref-1")).thenReturn(row("unused", VoucherStatus.SUCCEEDED, 10000L));
        assertThat(service.redeem(request).amountSatang()).isEqualTo(10000L);
        verify(repository, never()).findRecipientPhone(any());
        verify(adapter, never()).redeem(anyString(), anyString());
    }

    @Test void disabledOrUnlicensedPaymentFeatureCannotRedeem() {
        when(repository.findPaymentRecipientPhone(botId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.redeem(request(messageId, 10000))).isInstanceOf(VoucherException.class);
        verifyNoInteractions(adapter);
        verify(repository, never()).claim(any(), anyString(), anyString(), anyString());
    }

    @Test void replayReturnsExistingSuccessAndCannotPayAnotherInvoiceWithTheSameVoucher() {
        claim();
        var fingerprint = ArgumentCaptor.forClass(String.class);
        var request = request(messageId, 10000);
        when(adapter.redeemPayment(phone, request.giftUrl(), 10000)).thenReturn(new TrueMoneyVoucherAdapter.Outcome(new BigDecimal("100.00"), "Sender", "ref-1"));
        when(repository.succeed(any(), anyLong(), anyString(), anyString())).thenReturn(row("unused", VoucherStatus.SUCCEEDED, 10000L));
        service.redeem(request);
        verify(repository).claim(any(), anyString(), anyString(), fingerprint.capture());
        when(repository.claim(any(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(repository.findByIdempotency(botId, request.idempotencyKey())).thenReturn(Optional.of(row(fingerprint.getValue(), VoucherStatus.SUCCEEDED, 10000L)));
        assertThat(service.redeem(request).status()).isEqualTo("SUCCEEDED");
        assertThatThrownBy(() -> service.redeem(request("223456789012345678", 10000))).isInstanceOf(VoucherConflictException.class);
        assertThatThrownBy(() -> service.redeem(request(messageId, 20000))).isInstanceOf(VoucherConflictException.class);
        verify(adapter, times(1)).redeemPayment(anyString(), anyString(), anyLong());
    }

    @Test void anotherVoucherCannotBeRedeemedForAnAlreadyClaimedInvoice() {
        when(repository.findPaymentRecipientPhone(botId)).thenReturn(Optional.of(phone));
        when(repository.claim(any(), anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(repository.findByPayment(botId, messageId)).thenReturn(Optional.of(row("another-payer-and-voucher", VoucherStatus.REDEEMING, null)));
        assertThatThrownBy(() -> service.redeem(request(messageId, 10000))).isInstanceOf(VoucherConflictException.class);
        verifyNoInteractions(adapter);
    }

    @Test void ambiguousUpstreamFailureHoldsInvoiceForReconciliation() {
        claim();
        when(adapter.redeemPayment(anyString(), anyString(), anyLong())).thenThrow(new VoucherException("UPSTREAM_TIMEOUT", "timeout"));
        when(repository.fail(redemptionId, VoucherStatus.RECONCILIATION_REQUIRED, "UPSTREAM_TIMEOUT", "timeout"))
                .thenReturn(row("unused", VoucherStatus.RECONCILIATION_REQUIRED, null));
        assertThat(service.redeem(request(messageId, 10000)).status()).isEqualTo("RECONCILIATION_REQUIRED");
    }

    @Test void verificationMismatchAllowsAnotherVoucherButNeverReportsSuccess() {
        claim();
        when(adapter.redeemPayment(anyString(), anyString(), anyLong())).thenThrow(new VoucherException("VOUCHER_AMOUNT_MISMATCH", "wrong amount"));
        when(repository.fail(redemptionId, VoucherStatus.VERIFY_FAILED, "VOUCHER_AMOUNT_MISMATCH", "wrong amount"))
                .thenReturn(row("unused", VoucherStatus.VERIFY_FAILED, null));
        assertThat(service.redeem(request(messageId, 10000)).status()).isEqualTo("VERIFY_FAILED");
        verify(repository, never()).succeed(any(), anyLong(), anyString(), anyString());
    }

    @Test void differentActualReceivedAmountCannotMarkInvoicePaid() {
        claim();
        when(adapter.redeemPayment(anyString(), anyString(), anyLong())).thenReturn(new TrueMoneyVoucherAdapter.Outcome(new BigDecimal("50"), "Sender", "ref-1"));
        when(repository.fail(eq(redemptionId), eq(VoucherStatus.RECONCILIATION_REQUIRED), eq("REDEMPTION_OUTCOME_UNKNOWN"), anyString()))
                .thenReturn(row("unused", VoucherStatus.RECONCILIATION_REQUIRED, null));
        assertThat(service.redeem(request(messageId, 10000)).status()).isEqualTo("RECONCILIATION_REQUIRED");
        verify(repository, never()).succeed(any(), anyLong(), anyString(), anyString());
    }

    @Test void verifiesExactAmountAndOneRecipientBeforeSendingAnyRedeemRequest() throws Exception {
        var json = JsonMapper.builder().build();
        TrueMoneyVoucherAdapter.validatePaymentVoucher(json.readTree("{\"member\":1,\"amount_baht\":\"100.00\"}"), 10000);
        for (String invalid : new String[]{"{\"member\":1,\"amount_baht\":\"99\"}", "{\"member\":2,\"amount_baht\":\"100\"}", "{\"member\":1}", "{\"member\":1,\"amount_baht\":\"100.001\"}"}) {
            assertThatThrownBy(() -> TrueMoneyVoucherAdapter.validatePaymentVoucher(json.readTree(invalid), 10000)).isInstanceOf(VoucherException.class);
        }
    }

    @Test void paymentContextRequiresBothValidAmountAndMessageButLegacyWalletRequestStillWorks() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            assertThat(validator.validate(request(messageId, 10000))).isEmpty();
            assertThat(validator.validate(request(messageId, 0))).isNotEmpty();
            assertThat(validator.validate(request(null, 10000))).isNotEmpty();
            assertThat(validator.validate(request("not-a-discord-id", 10000))).isNotEmpty();
            assertThat(validator.validate(new RedeemTrueMoneyVoucherRequest(botId, "1494842858132471980", "https://gift.truemoney.com/campaign/?v=valid", "discord:test-123"))).isEmpty();
        }
    }
}
