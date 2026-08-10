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
        String phone = repository.findRecipientPhone(request.botId())
                .filter(value -> value.matches("^0[0-9]{8,9}$"))
                .orElseThrow(() -> new VoucherException(
                        "FEATURE_NOT_READY",
                        "Bot requires an active wallet-topup installation with TRUEMONEY_PHONE configured"
                ));
        String voucherHash = sha256(request.giftUrl());
        String fingerprint = sha256(
                request.botId() + "\0" + request.memberDiscordId() + "\0" + phone + "\0" + voucherHash
        );

        var claim = repository.claim(request, phone, voucherHash, fingerprint);
        if (claim.isEmpty()) {
            VoucherRepository.RedemptionRow existing = repository
                    .findByIdempotency(request.botId(), request.idempotencyKey())
                    .or(() -> repository.findByVoucherHash(voucherHash))
                    .orElseThrow(() -> new VoucherConflictException(
                            "Voucher redemption conflicts with an existing operation"
                    ));
            if (!fingerprint.equals(existing.requestFingerprint())) {
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

        try {
            TrueMoneyVoucherAdapter.Outcome outcome = adapter.redeem(phone, request.giftUrl());
            long amountSatang = exactPositiveSatang(outcome.amountBaht());
            if (outcome.reference() == null || outcome.reference().isBlank()) {
                throw new VoucherException(
                        "UPSTREAM_INVALID_REFERENCE",
                        "TrueMoney returned no redemption reference"
                );
            }
            return repository.succeed(
                    claim.get(), amountSatang, outcome.issuer(), outcome.reference()
            ).response();
        } catch (VoucherException exception) {
            VoucherStatus status;
            if ("VOUCHER_INVALID".equals(exception.code()) || "BAD_GIFT_URL".equals(exception.code())) {
                status = VoucherStatus.VERIFY_FAILED;
            } else if ("REDEMPTION_OUTCOME_UNKNOWN".equals(exception.code())) {
                status = VoucherStatus.RECONCILIATION_REQUIRED;
            } else {
                status = VoucherStatus.REDEEM_FAILED;
            }
            return repository.fail(
                    claim.get(), status, exception.code(), safeMessage(exception.getMessage())
            ).response();
        } catch (RuntimeException exception) {
            return repository.fail(
                    claim.get(), VoucherStatus.REDEEM_FAILED,
                    "UPSTREAM_FAILURE", "TrueMoney request failed"
            ).response();
        }
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
