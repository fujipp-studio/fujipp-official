package com.fujipp.backend.robux;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice(assignableTypes=RobuxController.class)
class RobuxExceptionHandler {
    @ExceptionHandler(RobuxException.class)
    ResponseEntity<Map<String,String>> handle(RobuxException error){
        HttpStatus status="INSUFFICIENT_FUNDS".equals(error.code())?HttpStatus.CONFLICT:HttpStatus.BAD_REQUEST;
        return ResponseEntity.status(status).body(Map.of("code",error.code(),"detail",error.getMessage()));
    }
}
