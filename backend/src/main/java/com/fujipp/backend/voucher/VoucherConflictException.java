package com.fujipp.backend.voucher;

final class VoucherConflictException extends RuntimeException {

    VoucherConflictException(String message) {
        super(message);
    }
}
