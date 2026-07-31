package com.fujipp.backend.work.admin;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = AdminWorkController.class)
public class AdminWorkExceptionHandler {

    @ExceptionHandler(AdminWorkNotFoundException.class)
    ProblemDetail handleNotFound() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                "The requested work does not exist"
        );
        problem.setTitle("Work not found");
        return problem;
    }

    @ExceptionHandler(AdminWorkConflictException.class)
    ProblemDetail handleConflict(AdminWorkConflictException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                exception.getMessage()
        );
        problem.setTitle("Work conflict");
        return problem;
    }

    @ExceptionHandler(AdminWorkValidationException.class)
    ProblemDetail handleValidation(AdminWorkValidationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );
        problem.setTitle("Invalid work");
        return problem;
    }

    @ExceptionHandler(CloudinaryException.class)
    ProblemDetail handleCloudinary(CloudinaryException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_GATEWAY,
                exception.getMessage()
        );
        problem.setTitle("Media service unavailable");
        return problem;
    }
}
