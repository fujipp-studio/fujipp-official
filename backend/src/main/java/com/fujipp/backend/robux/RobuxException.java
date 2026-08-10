package com.fujipp.backend.robux;

final class RobuxException extends RuntimeException {
    private final String code;
    RobuxException(String code,String message){super(message);this.code=code;}
    String code(){return code;}
}
