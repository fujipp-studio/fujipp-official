package com.fujipp.backend.store;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import com.fujipp.backend.work.admin.CloudinaryException;
import com.fujipp.backend.runtime.RuntimeSlotController;
import com.fujipp.backend.runtime.AdminRuntimeController;
import com.fujipp.backend.auth.AdminUserController;

@RestControllerAdvice(assignableTypes = {
        StoreCatalogController.class,
        BotController.class,
        FeatureLicenseController.class,
        StoreOrderController.class,
        AdminFeatureController.class,
        AdminBotController.class,
        RuntimeSlotController.class
        ,AdminRuntimeController.class
        ,AdminUserController.class
})
public class StoreExceptionHandler {

    @ExceptionHandler(StoreNotFoundException.class)
    ProblemDetail handleNotFound(StoreNotFoundException exception) {
        return problem(HttpStatus.NOT_FOUND, "Store resource not found", exception.getMessage());
    }

    @ExceptionHandler(StoreConflictException.class)
    ProblemDetail handleConflict(StoreConflictException exception) {
        return problem(HttpStatus.CONFLICT, "Store operation conflict", exception.getMessage());
    }

    @ExceptionHandler(StoreValidationException.class)
    ProblemDetail handleValidation(StoreValidationException exception) {
        return problem(HttpStatus.BAD_REQUEST, "Invalid store operation", exception.getMessage());
    }

    @ExceptionHandler(CloudinaryException.class)
    ProblemDetail handleCloudinary(CloudinaryException exception) {
        return problem(
                HttpStatus.BAD_GATEWAY,
                "Media service unavailable",
                exception.getMessage()
        );
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        return problem;
    }
}
