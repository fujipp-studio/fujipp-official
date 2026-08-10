package com.fujipp.backend.wallet;

final class WalletException extends RuntimeException {
    private final String code;
    WalletException(String code, String message) { super(message); this.code = code; }
    String code() { return code; }
}
