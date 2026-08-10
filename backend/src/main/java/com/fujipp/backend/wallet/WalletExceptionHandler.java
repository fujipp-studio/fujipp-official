package com.fujipp.backend.wallet;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes=WalletController.class)
class WalletExceptionHandler {
    @ExceptionHandler(WalletException.class)
    ProblemDetail handle(WalletException error) {
        HttpStatus status=switch(error.code()) {
            case "FEATURE_NOT_ACTIVE" -> HttpStatus.FORBIDDEN;
            case "SESSION_EXPIRED" -> HttpStatus.GONE;
            default -> HttpStatus.UNPROCESSABLE_ENTITY;
        };
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(status,error.getMessage());
        problem.setTitle("Wallet operation failed"); problem.setProperty("code",error.code()); return problem;
    }
}
