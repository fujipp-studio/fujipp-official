package com.fujipp.backend.auth;

public class InvalidTokenSubjectException extends RuntimeException {

    public InvalidTokenSubjectException() {
        super("Token subject is not a valid user ID");
    }
}
