package com.fujipp.backend.work;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = WorkController.class)
public class WorkExceptionHandler {

    @ExceptionHandler(WorkNotFoundException.class)
    ProblemDetail handleNotFound() {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                "The requested published work does not exist"
        );
        problem.setTitle("Work not found");
        return problem;
    }
}
