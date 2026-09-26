package com.fujipp.backend.wallet;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

import static org.assertj.core.api.Assertions.assertThat;

class WalletExceptionHandlerTests {
    private final WalletExceptionHandler handler=new WalletExceptionHandler();

    @Test
    void returnsBadGatewayWhenSlipOkIsUnavailable() {
        ProblemDetail problem=handler.handle(new WalletException(
                "SLIPOK_UNAVAILABLE",
                "ระบบตรวจสลิปขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง"
        ));

        assertThat(problem.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY.value());
        assertThat(problem.getProperties()).containsEntry("code","SLIPOK_UNAVAILABLE");
        assertThat(problem.getDetail()).contains("กรุณาลองใหม่ภายหลัง");
    }
}
