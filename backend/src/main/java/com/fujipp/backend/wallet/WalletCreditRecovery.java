package com.fujipp.backend.wallet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Replays verified receipts only. Never contacts a payment provider. */
@Component
class WalletCreditRecovery {
    private static final Logger log = LoggerFactory.getLogger(WalletCreditRecovery.class);
    private final WalletRepository repository;

    WalletCreditRecovery(WalletRepository repository) { this.repository = repository; }

    @Scheduled(fixedDelayString="${app.wallet.credit-recovery-ms:10000}", initialDelay=30000)
    void recover() {
        for (var receipt : repository.pendingVoucherCredits()) {
            try {
                repository.settleVoucher(receipt.id(), receipt.botId(), receipt.memberId());
            } catch (RuntimeException error) {
                // No provider payload, recipient phone or gift URL in application logs.
                log.warn("Wallet credit recovery requires review: redemption={} bot={}", receipt.id(), receipt.botId());
            }
        }
    }
}
