package com.fujipp.backend.auth;

public class UserAccountNotFoundException extends RuntimeException {

    public UserAccountNotFoundException() {
        super("User account was not found");
    }
}
