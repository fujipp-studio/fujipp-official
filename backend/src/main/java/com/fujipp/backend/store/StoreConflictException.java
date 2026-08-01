package com.fujipp.backend.store;

public class StoreConflictException extends RuntimeException {
    public StoreConflictException(String message) {
        super(message);
    }

    public StoreConflictException(String message, Throwable cause) {
        super(message, cause);
    }
}
