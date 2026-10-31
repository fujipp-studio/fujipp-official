package com.fujipp.backend.wallet;

import com.fujipp.backend.store.StoreSecretCipher;
import com.fujipp.backend.topup.PromptPayQrGenerator;
import com.fujipp.backend.voucher.*;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import tools.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class WalletVoucherTests {
    final UUID bot=UUID.randomUUID(), receipt=UUID.randomUUID();
    final String member="111111111111111111";
    final WalletRepository repository=mock(WalletRepository.class);
    final VoucherService vouchers=mock(VoucherService.class);
    final WalletService service=new WalletService(repository,vouchers,mock(SlipOkAdapter.class),mock(StoreSecretCipher.class),new PromptPayQrGenerator(),new ObjectMapper());
    final WalletRequests.VoucherTopup request=new WalletRequests.VoucherTopup(bot,member,"https://gift.truemoney.com/campaign/?v=synthetic","discord:test-123");
    void settings() {
        var settings=mock(WalletRepository.Settings.class);
        when(settings.voucherFeeMode()).thenReturn("FIXED"); when(settings.voucherFee()).thenReturn(500L);
        when(repository.settings(bot)).thenReturn(Optional.of(settings));
    }
    VoucherRedemptionResponse response(String status) {
        var now=OffsetDateTime.now();
        return new VoucherRedemptionResponse(receipt,bot,member,status,status.equals("SUCCEEDED")?200000L:null,"THB",null,"synthetic",null,null,now,now,now);
    }
    @Test void creditsFromThePersistedReceiptNotTheNewInteractionOrCurrentFee() {
        settings(); when(vouchers.redeemWallet(any(),any())).thenReturn(response("SUCCEEDED"));
        var credit=new WalletResponses.Topup(UUID.randomUUID(),199500,199500,"THB","TRUEMONEY",true,OffsetDateTime.now());
        when(repository.settleVoucher(receipt,bot,member)).thenReturn(credit);
        assertThat(service.voucher(request)).isEqualTo(credit);
        verify(repository).settleVoucher(receipt,bot,member);
        verify(repository,never()).settle(any(),any(),anyString(),anyLong(),anyString(),anyString(),anyString());
    }
    @Test void uncertainAndProcessingReceiptsNeverCreditWallets() {
        settings();
        for (String status:new String[]{"RECONCILIATION_REQUIRED","REDEEMING"}) {
            when(vouchers.redeemWallet(any(),any())).thenReturn(response(status));
            assertThatThrownBy(()->service.voucher(request)).isInstanceOfSatisfying(WalletException.class,
                    e->assertThat(e.code()).isEqualTo(status.equals("REDEEMING")?"TOPUP_PROCESSING":"TOPUP_REVIEW_REQUIRED"));
        }
        verify(repository,never()).settleVoucher(any(),any(),anyString());
    }
    @Test void databaseInterruptionAfterReceiptTellsCustomerToWaitWithoutRedeemingAgain() {
        settings(); when(vouchers.redeemWallet(any(),any())).thenReturn(response("SUCCEEDED"));
        when(repository.settleVoucher(receipt,bot,member)).thenThrow(new DataAccessResourceFailureException("synthetic disconnect"));
        assertThatThrownBy(()->service.voucher(request)).isInstanceOfSatisfying(WalletException.class,
                e->assertThat(e.code()).isEqualTo("TOPUP_PROCESSING"));
        verify(vouchers,times(1)).redeemWallet(any(),any());
    }
    @Test void recoveryUsesOnlyDatabaseReceiptsAndHasNoProviderDependency() {
        when(repository.pendingVoucherCredits()).thenReturn(java.util.List.of(new WalletRepository.VerifiedReceipt(receipt,bot,member)));
        new WalletCreditRecovery(repository).recover();
        verify(repository).settleVoucher(receipt,bot,member); verifyNoInteractions(vouchers);
    }
}
