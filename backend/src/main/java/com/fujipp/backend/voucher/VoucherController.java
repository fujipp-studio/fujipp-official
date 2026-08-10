package com.fujipp.backend.voucher;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/vouchers")
class VoucherController {

    private final VoucherService service;

    VoucherController(VoucherService service) {
        this.service = service;
    }

    @PostMapping("/truemoney/redeem")
    ResponseEntity<VoucherRedemptionResponse> redeem(
            @Valid @RequestBody RedeemTrueMoneyVoucherRequest request
    ) {
        return ResponseEntity.ok(service.redeem(request));
    }
}
