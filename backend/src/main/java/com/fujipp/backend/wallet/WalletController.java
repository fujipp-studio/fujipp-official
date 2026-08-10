package com.fujipp.backend.wallet;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Validated
@RestController
@RequestMapping("/internal/v1/wallet")
class WalletController {
    private final WalletService service;
    WalletController(WalletService service) { this.service=service; }

    @GetMapping("/balance")
    WalletResponses.Balance balance(@RequestParam UUID botId,
            @RequestParam @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId) {
        return service.balance(botId,memberDiscordId);
    }
    @PostMapping("/topups/truemoney") WalletResponses.Topup voucher(@Valid @RequestBody WalletRequests.VoucherTopup body) { return service.voucher(body); }
    @PostMapping("/topups/promptpay") WalletResponses.PromptPaySession promptPay(@Valid @RequestBody WalletRequests.CreatePromptPay body) { return service.createPromptPay(body); }
    @PostMapping("/topups/slip") WalletResponses.Topup slip(@Valid @RequestBody WalletRequests.VerifySlip body) { return service.verifySlip(body); }
    @PostMapping("/adjustments") WalletResponses.Adjustment adjustment(@Valid @RequestBody WalletRequests.Adjustment body) { return service.adjust(body); }
    @GetMapping("/history") WalletResponses.History history(@RequestParam UUID botId,
            @RequestParam @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId,
            @RequestParam(defaultValue="10") int limit) { return service.history(botId,memberDiscordId,limit); }
    @GetMapping("/monthly-summary") WalletResponses.MonthlySummary monthlySummary(@RequestParam UUID botId,
            @RequestParam(required=false) @Pattern(regexp="^[0-9]{15,30}$") String memberDiscordId) {
        return service.monthlySummary(botId,memberDiscordId);
    }
    @GetMapping("/leaderboard") WalletResponses.Leaderboard leaderboard(@RequestParam UUID botId,
            @RequestParam(defaultValue="50") int limit) { return service.leaderboard(botId,limit); }
}
