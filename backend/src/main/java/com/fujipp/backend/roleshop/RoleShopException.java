package com.fujipp.backend.roleshop;

final class RoleShopException extends RuntimeException {
    private final String code;
    RoleShopException(String code,String message) { super(message); this.code=code; }
    String code() { return code; }
}
