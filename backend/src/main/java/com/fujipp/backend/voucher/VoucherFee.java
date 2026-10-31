package com.fujipp.backend.voucher;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Immutable fee policy captured before the irreversible redemption. */
public record VoucherFee(String mode, long value) {
    public VoucherFee {
        if (!("FIXED".equals(mode) || "PERCENT".equals(mode)) || value < 0
                || value > 9_007_199_254_740_991L || ("PERCENT".equals(mode) && value > 100)) {
            throw new IllegalArgumentException("Invalid TrueMoney fee configuration");
        }
    }

    public long net(long gross) {
        long fee = "PERCENT".equals(mode)
                ? BigDecimal.valueOf(gross).multiply(BigDecimal.valueOf(value))
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.HALF_UP).longValueExact()
                : value;
        if (gross <= 0 || fee >= gross) {
            throw new VoucherException("VOUCHER_FEE_EXCEEDS_AMOUNT", "ยอดซองต้องมากกว่าค่าธรรมเนียม ยังไม่ได้รับเงินจากซอง");
        }
        return gross - fee;
    }
}
