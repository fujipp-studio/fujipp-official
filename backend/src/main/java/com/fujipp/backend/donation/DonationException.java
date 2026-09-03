package com.fujipp.backend.donation;

final class DonationException extends RuntimeException {
    private final String code;
    private final Kind kind;

    DonationException(String code, String message, Kind kind) {
        super(message);
        this.code = code;
        this.kind = kind;
    }

    String code() { return code; }
    Kind kind() { return kind; }

    enum Kind { VALIDATION, NOT_FOUND, CONFLICT, CONFIGURATION, UPSTREAM }
}
