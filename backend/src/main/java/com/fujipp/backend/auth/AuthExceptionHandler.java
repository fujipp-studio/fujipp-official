package com.fujipp.backend.auth;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class AuthExceptionHandler {

    @ExceptionHandler(AccountNotActiveException.class)
    ProblemDetail handleAccountNotActive(AccountNotActiveException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "This account cannot access the application"
        );
        problem.setTitle("Account is not active");
        problem.setProperty("accountStatus", exception.getStatus());
        return problem;
    }

    @ExceptionHandler(UserAccountNotFoundException.class)
    ProblemDetail handleAccountNotFound() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.FORBIDDEN,
                "No application account exists for this authenticated user"
        );
        problem.setTitle("Account is unavailable");
        return problem;
    }

    @ExceptionHandler(InvalidTokenSubjectException.class)
    ProblemDetail handleInvalidTokenSubject() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.UNAUTHORIZED,
                "The token subject is not a valid user ID"
        );
        problem.setTitle("Invalid access token");
        return problem;
    }
}
