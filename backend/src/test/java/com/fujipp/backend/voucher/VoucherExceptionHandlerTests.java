package com.fujipp.backend.voucher;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import static org.assertj.core.api.Assertions.assertThat;

class VoucherExceptionHandlerTests {

    private final VoucherExceptionHandler handler = new VoucherExceptionHandler();

    @Test
    void returnsConflictWithReadableCodeWhenVoucherWasAlreadyUsed() {
        ProblemDetail problem = handler.handleConflict(
                new VoucherConflictException("Idempotency key or voucher has already been used for another request")
        );

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.CONFLICT.value());
        assertThat(problem.getProperties()).containsEntry("code", "VOUCHER_ALREADY_USED");
        assertThat(problem.getDetail()).contains("ซอง TrueMoney").contains("กรุณาใช้ซองใหม่");
    }
}
