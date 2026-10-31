package com.fujipp.backend.voucher;

final class VoucherException extends RuntimeException {

    private final String code;
    private final boolean reconciliationRequired;
    private final String evidence;

    VoucherException(String code, String message) {
        this(code, message, false);
    }

    VoucherException(String code, String message, boolean reconciliationRequired) {
        this(code, message, reconciliationRequired, null);
    }

    VoucherException(String code, String message, boolean reconciliationRequired, String evidence) {
        super(message);
        this.evidence = evidence;
        this.code = code;
        this.reconciliationRequired = reconciliationRequired;
    }

    String code() {
        return code;
    }

    String evidence() { return evidence; }

    boolean reconciliationRequired() { return reconciliationRequired; }
}
