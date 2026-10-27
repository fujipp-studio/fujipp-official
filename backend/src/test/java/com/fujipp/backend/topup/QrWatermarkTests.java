package com.fujipp.backend.topup;

import com.google.zxing.*;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.multi.qrcode.QRCodeMultiReader;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

class QrWatermarkTests {
    private final JsonMapper json=JsonMapper.builder().build();
    private final PromptPayQrGenerator generator=new PromptPayQrGenerator();
    private QrWatermark parse(String value) { return QrWatermark.parse(json.readTree(value),"ร้านขนม Kanom"); }
    private static BufferedImage image(String data) throws Exception {
        return ImageIO.read(new ByteArrayInputStream(Base64.getDecoder().decode(data.substring(data.indexOf(',')+1))));
    }
    private static String png(BufferedImage image) throws Exception {
        var output=new ByteArrayOutputStream(); ImageIO.write(image,"PNG",output);
        return "data:image/png;base64,"+Base64.getEncoder().encodeToString(output.toByteArray());
    }
    private static String decode(BufferedImage image) throws Exception {
        int[] pixels=image.getRGB(0,0,image.getWidth(),image.getHeight(),null,0,image.getWidth());
        // Inspect all finder-pattern candidates in the complete image, including its branding.
        var results=new QRCodeMultiReader().decodeMultiple(new BinaryBitmap(new HybridBinarizer(
            new RGBLuminanceSource(image.getWidth(),image.getHeight(),pixels))),Map.of(DecodeHintType.TRY_HARDER,true));
        assertThat(results).hasSize(1);
        return results[0].getText();
    }
    @Test void noWatermarkKeepsTheExistingPaymentImageExactly() {
        var plain=generator.generate("0812345678",5000);
        assertThat(generator.generate("0812345678",5000,parse("{\"mode\":\"NONE\"}")).imageDataUri()).isEqualTo(plain.imageDataUri());
        assertThat(QrWatermark.parse(null,"Shop").mode()).isEqualTo(QrWatermark.Mode.NONE);
    }
    @Test void thaiTextAndUploadedLogoStayOutsideTheQrAndRemainScannable() throws Exception {
        var logo=new BufferedImage(80,40,BufferedImage.TYPE_INT_RGB);
        var graphics=logo.createGraphics(); graphics.setColor(Color.BLUE); graphics.fillRect(0,0,80,40); graphics.dispose();
        var logoConfig=json.createObjectNode().put("mode","LOGO").put("logoDataUri",png(logo));
        for (String recipient:new String[]{"0812345678","1234567890123"}) {
            var plain=generator.generate(recipient,5000);
            var original=image(plain.imageDataUri());
            java.nio.file.Files.createDirectories(java.nio.file.Path.of("target/qr-watermark-qa"));
            ImageIO.write(original,"PNG",java.nio.file.Path.of("target/qr-watermark-qa/plain-"+recipient.length()+".png").toFile());
            try { assertThat(decode(original)).isEqualTo(plain.payload()); }
            catch (NotFoundException error) { throw new AssertionError("Plain "+recipient.length()+" digit QR",error); }
            for (QrWatermark mark:new QrWatermark[]{parse("{\"mode\":\"TEXT\",\"text\":\"ร้านขนม Kanom\"}"),QrWatermark.parse(logoConfig,"Shop")}) {
                var result=generator.generate(recipient,5000,mark);
                var branded=image(result.imageDataUri());
                assertThat(branded.getWidth()).isEqualTo(512); assertThat(branded.getHeight()).isEqualTo(608);
                org.junit.jupiter.api.Assertions.assertArrayEquals(original.getRGB(0,0,512,512,null,0,512),branded.getRGB(0,0,512,512,null,0,512));
                java.nio.file.Path directory=java.nio.file.Path.of("target/qr-watermark-qa");
                java.nio.file.Files.createDirectories(directory);
                ImageIO.write(branded,"PNG",directory.resolve("qr-"+recipient.length()+"-"+mark.mode()+".png").toFile());
                String decoded;
                try { decoded=decode(branded); }
                catch (NotFoundException error) { throw new AssertionError("Could not scan "+recipient.length()+" digit "+mark.mode()+" QR",error); }
                assertThat(decoded).isEqualTo(plain.payload());
                assertThat(decoded).contains("540550.00","5303764");
                assertThat(Arrays.stream(branded.getRGB(0,512,512,96,null,0,512)).anyMatch(pixel->(pixel&0xffffff)!=0xffffff)).isTrue();
            }
        }
        try(var input=getClass().getResourceAsStream("/fonts/NotoSansThai.ttf")) {
            assertThat(Font.createFont(Font.TRUETYPE_FONT,input).canDisplayUpTo("ร้านขนม Kanom")).isEqualTo(-1);
        }
    }
    @Test void blankTextUsesTheBotShopNameAndLongNamesAreBounded() {
        assertThat(parse("{\"mode\":\"TEXT\",\"text\":\"\"}").text()).isEqualTo("ร้านขนม Kanom");
        assertThat(QrWatermark.parse(json.readTree("{\"mode\":\"TEXT\"}"),"A".repeat(100)).text()).hasSize(60);
    }
    @Test void rejectsRemoteLogosInvalidTypesOversizedImagesAndControlCharacters() throws Exception {
        for (String value:new String[]{"[]","{\"mode\":\"OTHER\"}","{\"mode\":\"LOGO\"}",
            "{\"mode\":\"TEXT\",\"text\":12}","{\"mode\":\"TEXT\",\"text\":\"line\\nline\"}",
            "{\"mode\":\"LOGO\",\"logoDataUri\":\"https://example.invalid/logo.png\"}",
            "{\"mode\":\"LOGO\",\"logoDataUri\":\"data:image/png;base64,aGVsbG8=\"}"})
            assertThatThrownBy(()->parse(value)).isInstanceOf(IllegalArgumentException.class);
        var config=json.createObjectNode().put("mode","LOGO").put("logoDataUri",png(new BufferedImage(321,20,BufferedImage.TYPE_INT_RGB)));
        assertThatThrownBy(()->QrWatermark.parse(config,"Shop")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->parse("{\"mode\":\"TEXT\",\"text\":\""+"A".repeat(61)+"\"}")).isInstanceOf(IllegalArgumentException.class);
    }
}
