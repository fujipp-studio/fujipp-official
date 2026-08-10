package com.fujipp.backend.wallet;

import com.fujipp.backend.store.StoreSecretCipher;
import com.fujipp.backend.voucher.RedeemTrueMoneyVoucherRequest;
import com.fujipp.backend.voucher.VoucherRedemptionResponse;
import com.fujipp.backend.voucher.VoucherService;
import org.springframework.stereotype.Service;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
class WalletService {
    private final WalletRepository repository;
    private final VoucherService vouchers;
    private final SlipOkAdapter slipOk;
    private final StoreSecretCipher cipher;

    WalletService(WalletRepository repository, VoucherService vouchers, SlipOkAdapter slipOk, StoreSecretCipher cipher) {
        this.repository=repository; this.vouchers=vouchers; this.slipOk=slipOk; this.cipher=cipher;
    }

    WalletResponses.Balance balance(java.util.UUID botId,String memberId) {
        requireSettings(botId); return new WalletResponses.Balance(repository.balance(botId,memberId),"THB");
    }

    WalletResponses.Topup voucher(WalletRequests.VoucherTopup request) {
        WalletRepository.Settings settings=requireSettings(request.botId());
        VoucherRedemptionResponse redeemed=vouchers.redeem(new RedeemTrueMoneyVoucherRequest(
                request.botId(),request.memberDiscordId(),request.giftUrl(),request.idempotencyKey()));
        if (!"SUCCEEDED".equals(redeemed.status()) || redeemed.amountSatang()==null) {
            throw new WalletException(redeemed.failureCode()==null?"VOUCHER_FAILED":redeemed.failureCode(),
                    redeemed.failureMessage()==null?"TrueMoney top-up failed":redeemed.failureMessage());
        }
        long fee = "PERCENT".equals(settings.voucherFeeMode())
                ? java.math.BigDecimal.valueOf(redeemed.amountSatang())
                    .multiply(java.math.BigDecimal.valueOf(settings.voucherFeePercent()==null?0:settings.voucherFeePercent()))
                    .divide(java.math.BigDecimal.valueOf(100),0,java.math.RoundingMode.HALF_UP).longValueExact()
                : settings.voucherFee()==null?0:settings.voucherFee();
        long credit=redeemed.amountSatang()-Math.min(fee,redeemed.amountSatang()-1);
        return repository.settle(null,request.botId(),request.memberDiscordId(),credit,
                redeemed.reference(),"wallet:"+request.idempotencyKey(),"TRUEMONEY");
    }

    WalletResponses.PromptPaySession createPromptPay(WalletRequests.CreatePromptPay request) {
        WalletRepository.Settings settings=requireSettings(request.botId());
        long minimum=settings.minimum()==null?1:settings.minimum();
        if (request.amountSatang()<minimum) throw new WalletException("BELOW_MINIMUM","Amount is below the configured minimum");
        if (settings.promptPayId()==null || settings.accountName()==null) throw new WalletException("PROMPTPAY_NOT_CONFIGURED","PromptPay is not configured");
        int expiryMinutes = settings.qrExpiryMinutes() == null
                ? 5
                : Math.max(1, Math.min(60, settings.qrExpiryMinutes()));
        WalletRepository.PromptSession session=repository.createPromptPay(request, expiryMinutes);
        String amount=java.math.BigDecimal.valueOf(request.amountSatang(),2).toPlainString();
        String qr="https://promptpay.io/"+URLEncoder.encode(settings.promptPayId(),StandardCharsets.UTF_8)+"/"+amount+".png";
        return new WalletResponses.PromptPaySession(session.id(),session.amount(),"THB",settings.accountName(),qr,session.expiresAt());
    }

    WalletResponses.Topup verifySlip(WalletRequests.VerifySlip request) {
        WalletRepository.Settings settings=requireSettings(request.botId());
        WalletRepository.PromptSession session=repository.pendingSession(request.sessionId(),request.botId(),request.memberDiscordId())
                .orElseThrow(()->new WalletException("SESSION_EXPIRED","Payment session is missing or expired"));
        if (settings.branchCipher()==null || settings.keyCipher()==null) throw new WalletException("SLIPOK_NOT_CONFIGURED","SlipOK is not configured");
        String branch=cipher.decrypt(settings.branchCipher(),settings.branchNonce(),settings.branchVersion());
        String key=cipher.decrypt(settings.keyCipher(),settings.keyNonce(),settings.keyVersion());
        SlipOkAdapter.Result verified=slipOk.verify(branch,key,request.slipImageUrl(),session.amount());
        return repository.settle(session.id(),request.botId(),request.memberDiscordId(),session.amount(),
                verified.reference(),request.idempotencyKey(),"SLIPOK");
    }

    WalletResponses.Adjustment adjust(WalletRequests.Adjustment request) {
        requireSettings(request.botId());
        if (("ADD".equals(request.operation()) || "REMOVE".equals(request.operation()))
                && request.amountSatang() == 0) {
            throw new WalletException("INVALID_AMOUNT", "Adjustment amount must be greater than zero");
        }
        return repository.adjust(request);
    }

    WalletResponses.History history(java.util.UUID botId,String memberId,int limit) {
        requireSettings(botId); return repository.history(botId,memberId,Math.max(1,Math.min(50,limit)));
    }

    WalletResponses.MonthlySummary monthlySummary(java.util.UUID botId,String memberId) {
        requireSettings(botId); return repository.monthlySummary(botId,memberId);
    }

    WalletResponses.Leaderboard leaderboard(java.util.UUID botId,int limit) {
        requireSettings(botId); return repository.leaderboard(botId,Math.max(1,Math.min(50,limit)));
    }

    private WalletRepository.Settings requireSettings(java.util.UUID botId) {
        return repository.settings(botId).orElseThrow(()->new WalletException("FEATURE_NOT_ACTIVE","wallet-topup is not active"));
    }
}
