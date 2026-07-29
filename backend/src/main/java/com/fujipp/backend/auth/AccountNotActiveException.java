package com.fujipp.backend.auth;

public class AccountNotActiveException extends RuntimeException {

    private final AccountStatus status;

    public AccountNotActiveException(AccountStatus status) {
        super("User account is not active");
        this.status = status;
    }

    public AccountStatus getStatus() {
        return status;
    }
}
