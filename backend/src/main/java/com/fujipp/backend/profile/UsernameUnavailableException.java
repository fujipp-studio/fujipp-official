package com.fujipp.backend.profile;

public class UsernameUnavailableException extends RuntimeException {

    public enum Reason {
        TAKEN,
        RESERVED
    }

    private final Reason reason;

    public UsernameUnavailableException(Reason reason) {
        super("Username is unavailable");
        this.reason = reason;
    }

    public Reason getReason() {
        return reason;
    }
}
