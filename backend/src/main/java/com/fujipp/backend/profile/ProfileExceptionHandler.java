package com.fujipp.backend.profile;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ProfileExceptionHandler {

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
