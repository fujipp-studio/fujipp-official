package com.fujipp.backend.voucher;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class VoucherExceptionHandler {

    @ExceptionHandler(VoucherConflictException.class)
    ProblemDetail handleConflict(VoucherConflictException exception) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.CONFLICT,
                "ซอง TrueMoney นี้เคยถูกใช้หรือกำลังถูกประมวลผลแล้ว กรุณาใช้ซองใหม่"
        );
        problem.setTitle("Voucher conflict");
        problem.setProperty("code", "VOUCHER_ALREADY_USED");
        return problem;
    }

    @ExceptionHandler(VoucherException.class)
    ProblemDetail handleVoucher(VoucherException exception) {
        HttpStatus status = "FEATURE_NOT_READY".equals(exception.code())
                ? HttpStatus.FORBIDDEN
                : HttpStatus.BAD_GATEWAY;
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, exception.getMessage());
        problem.setTitle("Voucher redemption unavailable");
        problem.setProperty("code", exception.code());
        return problem;
    }
}
