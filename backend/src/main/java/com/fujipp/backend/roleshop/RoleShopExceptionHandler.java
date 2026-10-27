package com.fujipp.backend.roleshop;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice(assignableTypes=RoleShopController.class)
class RoleShopExceptionHandler {
    @ExceptionHandler(RoleShopException.class)
    ResponseEntity<Map<String,String>> handle(RoleShopException error) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("code",error.code(),"detail",error.getMessage()));
    }
}
