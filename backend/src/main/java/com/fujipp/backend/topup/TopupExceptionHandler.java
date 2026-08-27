package com.fujipp.backend.topup;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes=TopupController.class)
class TopupExceptionHandler {
    @ExceptionHandler(TopupException.class)
    ProblemDetail handle(TopupException exception) {
        HttpStatus status=switch(exception.kind()) {
            case VALIDATION -> HttpStatus.BAD_REQUEST;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case CONFIGURATION -> HttpStatus.SERVICE_UNAVAILABLE;
            case UPSTREAM -> HttpStatus.BAD_GATEWAY;
        };
        ProblemDetail problem=ProblemDetail.forStatusAndDetail(status,exception.getMessage());
        problem.setTitle("Wallet top-up failed");
        problem.setProperty("code",exception.code());
        return problem;
    }
}
