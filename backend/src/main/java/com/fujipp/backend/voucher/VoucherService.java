package com.fujipp.backend.voucher;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HexFormat;

@Service
public class VoucherService {

    private static final Duration STALE_AFTER = Duration.ofMinutes(2);

    private final VoucherRepository repository;
    private final TrueMoneyVoucherAdapter adapter;

    VoucherService(VoucherRepository repository, TrueMoneyVoucherAdapter adapter) {
        this.repository = repository;
        this.adapter = adapter;
    }

    public VoucherRedemptionResponse redeem(RedeemTrueMoneyVoucherRequest request) {
        return redeem(request, null);
    }

    public VoucherRedemptionResponse redeemWallet(RedeemTrueMoneyVoucherRequest request, VoucherFee fee) {
        if (request.paymentMessageId() != null) throw new IllegalArgumentException("Wallet cannot settle an invoice");
        return redeem(request, java.util.Objects.requireNonNull(fee));
    }

    private VoucherRedemptionResponse redeem(RedeemTrueMoneyVoucherRequest request, VoucherFee fee) {
        String canonical = canonicalGiftUrl(request.giftUrl());
        boolean payment = request.paymentMessageId() != null;
        String phone = (payment ? repository.findPaymentRecipientPhone(request.botId()) : repository.findRecipientPhone(request.botId()))
                .filter(value -> value.matches("^0[0-9]{8,9}$"))
                .orElseThrow(() -> new VoucherException(
                        "FEATURE_NOT_READY",
                        payment ? "Payment Trigger ต้องเปิดรับซองอั่งเปาและตั้งหมายเลข Wallet ให้ถูกต้อง"
                                : "Bot requires an active wallet-topup installation with TRUEMONEY_PHONE configured"
                ));
        String voucherHash = sha256(canonical);
        String aliasHash = sha256(canonical.replace("/campaign/?", "/campaign?"));
        String fingerprint = fingerprint(request, phone, voucherHash);
        String aliasFingerprint = fingerprint(request, phone, aliasHash);
        var previous = repository.findByVoucherHash(voucherHash)
                .or(() -> repository.findByVoucherHash(aliasHash));
        var claim = previous.isPresent() ? java.util.Optional.<java.util.UUID>empty()
                : fee == null ? repository.claim(request, phone, voucherHash, fingerprint)
                : repository.claimWallet(request, phone, voucherHash, fingerprint, fee);
        if (claim.isEmpty()) {
            VoucherRepository.RedemptionRow existing = repository
                    .findByIdempotency(request.botId(), request.idempotencyKey())
                    .or(() -> previous)
                    .or(() -> repository.findByVoucherHash(voucherHash))
                    .or(() -> payment ? repository.findByPayment(request.botId(), request.paymentMessageId()) : java.util.Optional.empty())
                    .orElseThrow(() -> new VoucherConflictException(
                        "ซองหรือรายการชำระเงินนี้ถูกใช้หรือกำลังประมวลผลแล้ว กรุณาตรวจสอบก่อนชำระซ้ำ"
                    ));
            if (!fingerprint.equals(existing.requestFingerprint()) && !aliasFingerprint.equals(existing.requestFingerprint())) {
                throw new VoucherConflictException(
                        "Idempotency key or voucher has already been used for another request"
                );
            }
            if (existing.status() == VoucherStatus.REDEEMING
                    && existing.processingStartedAt().isBefore(OffsetDateTime.now().minus(STALE_AFTER))) {
                return repository.reconcileStale(existing.id()).response();
            }
            return existing.response();
        }

        boolean received = false;
        String evidence = null;
        try {
            TrueMoneyVoucherAdapter.Outcome outcome = payment
                    ? adapter.redeemPayment(phone, canonical, request.expectedAmountSatang())
                    : fee == null ? adapter.redeem(phone, canonical) : adapter.redeemWallet(phone, canonical, fee);
            received = true;
            evidence = outcome.evidence();
            long amountSatang = exactPositiveSatang(outcome.amountBaht());
            if (payment && amountSatang != request.expectedAmountSatang()) {
                throw new VoucherException("REDEMPTION_OUTCOME_UNKNOWN", "ยอดเงินที่รับจริงไม่ตรงกับรายการ กรุณาติดต่อผู้ดูแลและอย่าชำระซ้ำ");
            }
            if (outcome.reference() == null || outcome.reference().isBlank()) {
                throw new VoucherException(
                        "UPSTREAM_INVALID_REFERENCE",
                        "TrueMoney returned no redemption reference"
                );
            }
            return (outcome.evidence() == null
                    ? repository.succeed(claim.get(), amountSatang, outcome.issuer(), outcome.reference())
                    : repository.succeed(claim.get(), amountSatang, outcome.issuer(), outcome.reference(), outcome.evidence())).response();
        } catch (VoucherException exception) {
            VoucherStatus status;
            if (received || exception.reconciliationRequired()) {
                status = VoucherStatus.RECONCILIATION_REQUIRED;
            } else if (java.util.Set.of("VOUCHER_INVALID", "BAD_GIFT_URL", "VOUCHER_AMOUNT_MISMATCH", "VOUCHER_NOT_SINGLE_RECIPIENT", "VOUCHER_FEE_EXCEEDS_AMOUNT").contains(exception.code())) {
                status = VoucherStatus.VERIFY_FAILED;
            } else if (payment || "REDEMPTION_OUTCOME_UNKNOWN".equals(exception.code())) {
                status = VoucherStatus.RECONCILIATION_REQUIRED;
            } else {
                status = VoucherStatus.REDEEM_FAILED;
            }
            return (exception.evidence() == null
                    ? repository.fail(claim.get(), status, exception.code(), safeMessage(exception.getMessage()))
                    : repository.fail(claim.get(), status, exception.code(), safeMessage(exception.getMessage()), exception.evidence())).response();
        } catch (RuntimeException exception) {
            String code = received ? "RECEIPT_PERSISTENCE_FAILED" : "UPSTREAM_FAILURE";
            String message = "Receipt outcome requires investigation; do not redeem again";
            return (evidence == null
                    ? repository.fail(claim.get(), VoucherStatus.RECONCILIATION_REQUIRED, code, message)
                    : repository.fail(claim.get(), VoucherStatus.RECONCILIATION_REQUIRED, code, message, evidence)).response();
        }
    }

    static String canonicalGiftUrl(String url) {
        if (url == null || !url.matches("^https://gift\\.truemoney\\.com/campaign/?\\?v=[A-Za-z0-9_-]{1,256}$")) {
            throw new VoucherException("BAD_GIFT_URL", "กรุณาใช้ลิงก์ซอง TrueMoney ที่ถูกต้อง");
        }
        return "https://gift.truemoney.com/campaign/?v=" + url.substring(url.indexOf("?v=") + 3);
    }

    private static String fingerprint(RedeemTrueMoneyVoucherRequest request, String phone, String hash) {
        return sha256(request.botId() + "\0" + request.memberDiscordId() + "\0" + phone + "\0" + hash
                + (request.paymentMessageId() != null ? "\0payment:" + request.paymentMessageId() + ":" + request.expectedAmountSatang() : ""));
    }

    private static long exactPositiveSatang(BigDecimal amountBaht) {
        if (amountBaht == null || amountBaht.signum() <= 0) {
            throw new VoucherException(
                    "UPSTREAM_INVALID_AMOUNT",
                    "TrueMoney returned a non-positive amount"
            );
        }
        try {
            return amountBaht.movePointRight(2).longValueExact();
        } catch (ArithmeticException exception) {
            throw new VoucherException(
                    "UPSTREAM_INVALID_AMOUNT",
                    "TrueMoney returned an amount with unsupported precision"
            );
        }
    }

    private static String safeMessage(String message) {
        if (message == null || message.isBlank()) {
            return "Voucher redemption failed";
        }
        return message.length() <= 500 ? message : message.substring(0, 500);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
