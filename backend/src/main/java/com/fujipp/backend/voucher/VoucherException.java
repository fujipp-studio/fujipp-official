package com.fujipp.backend.voucher;

final class VoucherException extends RuntimeException {

    private final String code;

    VoucherException(String code, String message) {
        super(message);
        this.code = code;
    }

    String code() {
        return code;
    }
}
