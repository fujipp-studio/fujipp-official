package com.fujipp.backend.wallet;

import com.fujipp.backend.store.StoreSecretCipher;
import com.fujipp.backend.topup.PromptPayQrGenerator;
import com.fujipp.backend.voucher.VoucherService;
import com.google.zxing.*;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;
import org.junit.jupiter.api.Test;
import javax.imageio.ImageIO;
import java.io.ByteArrayInputStream;
import java.time.OffsetDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WalletPromptPayTests {
    private final WalletRepository repository=mock(WalletRepository.class);
    private final WalletService service=new WalletService(repository,mock(VoucherService.class),
        mock(SlipOkAdapter.class),mock(StoreSecretCipher.class),new PromptPayQrGenerator());
    private final UUID bot=UUID.randomUUID();
    private final WalletRequests.CreatePromptPay request=new WalletRequests.CreatePromptPay(bot,"222222222222222222",5000);

    private void configure(String identifier) {
        when(repository.settings(bot)).thenReturn(Optional.of(new WalletRepository.Settings(
            1000L,0L,"FIXED",0,identifier,"Test shop",5,null,null,null,null,null,null)));
    }

    @Test void generatesADecodablePngWithTheConfiguredRecipientAndExactAmount() throws Exception {
        configure("0812345678");
        UUID session=UUID.randomUUID();
        var expiry=OffsetDateTime.now().plusMinutes(5);
        when(repository.createPromptPay(request,5)).thenReturn(new WalletRepository.PromptSession(session,5000,expiry));
        var response=service.createPromptPay(request);
        assertThat(response.sessionId()).isEqualTo(session);
        assertThat(response.amountSatang()).isEqualTo(5000);
        assertThat(response.expiresAt()).isEqualTo(expiry);
        assertThat(response.qrImageDataUri()).startsWith("data:image/png;base64,");
        byte[] png=Base64.getDecoder().decode(response.qrImageDataUri().substring("data:image/png;base64,".length()));
        var image=ImageIO.read(new ByteArrayInputStream(png));
        assertThat(image.getWidth()).isEqualTo(512);
        int[] pixels=image.getRGB(0,0,image.getWidth(),image.getHeight(),null,0,image.getWidth());
        var bitmap=new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(image.getWidth(),image.getHeight(),pixels)));
        String payload=new QRCodeReader().decode(bitmap).getText();
        assertThat(payload).isEqualTo(new PromptPayQrGenerator().generate("0812345678",5000).payload());
        assertThat(payload).contains("01130066812345678","5303764","540550.00","5802TH");
        // Retain the old field while Backend and Runner are rolled out separately.
        assertThat(response.qrUrl()).isEqualTo("https://promptpay.io/0812345678/50.00.png");
        verify(repository).createPromptPay(request,5);
    }

    @Test void invalidRecipientDoesNotLeaveAnUnusablePendingSession() {
        configure("1234");
        assertThatThrownBy(()->service.createPromptPay(request)).isInstanceOf(WalletException.class)
            .satisfies(error->assertThat(((WalletException)error).code()).isEqualTo("INVALID_PROMPTPAY_ID"));
        verify(repository,never()).createPromptPay(any(),anyInt());
    }
}
