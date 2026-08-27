package com.fujipp.backend.topup;

final class TopupException extends RuntimeException {
    private final String code;
    private final Kind kind;

    TopupException(String code, String message, Kind kind) {
        super(message);
        this.code = code;
        this.kind = kind;
    }

    String code() { return code; }
    Kind kind() { return kind; }

    enum Kind { VALIDATION, NOT_FOUND, CONFLICT, CONFIGURATION, UPSTREAM }
}
