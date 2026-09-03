package com.fujipp.backend.donation;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = {DonationController.class, AdminDonationController.class})
class DonationExceptionHandler {
    @ExceptionHandler(DonationException.class)
    ProblemDetail handle(DonationException exception) {
        HttpStatus status = switch (exception.kind()) {
            case VALIDATION -> HttpStatus.BAD_REQUEST;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case CONFIGURATION -> HttpStatus.SERVICE_UNAVAILABLE;
            case UPSTREAM -> HttpStatus.BAD_GATEWAY;
        };
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, exception.getMessage());
        problem.setTitle("Donation failed");
        problem.setProperty("code", exception.code());
        return problem;
    }
}
