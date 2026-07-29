package com.fujipp.backend.profile;

public class UsernameAlreadySetException extends RuntimeException {

    public UsernameAlreadySetException() {
        super("Username has already been set");
    }
}
