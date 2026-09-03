package com.fujipp.backend.profile;

import com.fujipp.backend.work.admin.CloudinaryException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ProfileExceptionHandler {

    @ExceptionHandler(ProfileValidationException.class)
    ProblemDetail handleValidation(ProfileValidationException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST,
                exception.getMessage()
        );
        problem.setTitle("Invalid profile request");
        return problem;
    }

    @ExceptionHandler(CloudinaryException.class)
    ProblemDetail handleCloudinary(CloudinaryException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.SERVICE_UNAVAILABLE,
                exception.getMessage()
        );
        problem.setTitle("Profile image service unavailable");
        return problem;
    }

    @ExceptionHandler(UsernameAlreadySetException.class)
    ProblemDetail handleUsernameAlreadySet() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "A username can only be set once"
        );
        problem.setTitle("Username already set");
        return problem;
    }

    @ExceptionHandler(UsernameUnavailableException.class)
    ProblemDetail handleUsernameUnavailable(UsernameUnavailableException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "Choose a different username"
        );
        problem.setTitle("Username is unavailable");
        problem.setProperty("reason", exception.getReason());
        return problem;
    }
}
