package com.fujipp.backend.topup;

import tools.jackson.databind.JsonNode;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Base64;

/** Branding is drawn below the complete QR image, outside its quiet zone. */
public record QrWatermark(Mode mode, String text, BufferedImage logo) {
    public enum Mode { NONE, TEXT, LOGO }
    public static final int MAX_LOGO_DATA_CHARS=60_000;
    public static QrWatermark none() { return new QrWatermark(Mode.NONE,"",null); }

    public static QrWatermark parse(JsonNode value,String shopName) {
        if (value==null || value.isNull()) return none();
        if (!value.isObject() || !value.path("mode").isTextual()) throw invalid("Choose a watermark type");
        Mode mode;
        try { mode=Mode.valueOf(value.path("mode").asText()); }
        catch (IllegalArgumentException error) { throw invalid("Watermark type must be NONE, TEXT or LOGO"); }
        String text=string(value,"text");
        if (text.codePointCount(0,text.length())>60 || text.codePoints().anyMatch(Character::isISOControl))
            throw invalid("Watermark text must be a single line of up to 60 characters");
        String data=string(value,"logoDataUri");
        BufferedImage image=data.isEmpty()?null:readLogo(data);
        if (mode==Mode.LOGO && image==null) throw invalid("Upload a logo before selecting logo watermark");
        String label=text.isBlank()?(shopName==null?"Shop":shopName):text.trim();
        label=label.replaceAll("\\p{Cntrl}","");
        if (label.codePointCount(0,label.length())>60) label=label.substring(0,label.offsetByCodePoints(0,60));
        return new QrWatermark(mode,label,image);
    }

    private static String string(JsonNode value,String key) {
        JsonNode item=value.get(key);
        if (item==null) return "";
        if (!item.isTextual()) throw invalid("Invalid watermark "+key);
        return item.asText();
    }

    private static BufferedImage readLogo(String data) {
        String prefix="data:image/png;base64,";
        if (!data.startsWith(prefix) || data.length()>MAX_LOGO_DATA_CHARS) throw invalid("Logo must be a small PNG image");
        try {
            byte[] bytes=Base64.getDecoder().decode(data.substring(prefix.length()));
            try (var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(input);
                if (!readers.hasNext()) throw invalid("Logo image cannot be read");
                var reader=readers.next();
                try {
                    reader.setInput(input,true,true);
                    if (!"PNG".equalsIgnoreCase(reader.getFormatName()) || reader.getWidth(0)<1 || reader.getHeight(0)<1
                        || reader.getWidth(0)>320 || reader.getHeight(0)>160)
                        throw invalid("Logo must be a PNG no larger than 320 × 160 pixels");
                    return reader.read(0);
                } finally { reader.dispose(); }
            }
        } catch (IOException error) { throw invalid("Logo image cannot be read"); }
        catch (IllegalArgumentException error) { throw invalid("Invalid PNG logo image"); }
    }

    BufferedImage decorate(BufferedImage qr) {
        if (mode==Mode.NONE) return qr;
        BufferedImage result=new BufferedImage(qr.getWidth(),qr.getHeight()+96,BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics=result.createGraphics();
        try {
            graphics.setColor(Color.WHITE); graphics.fillRect(0,0,result.getWidth(),result.getHeight());
            graphics.drawImage(qr,0,0,null);
            if (mode==Mode.LOGO) {
                double scale=Math.min(160.0/logo.getWidth(),64.0/logo.getHeight());
                int width=Math.max(1,(int)Math.round(logo.getWidth()*scale));
                int height=Math.max(1,(int)Math.round(logo.getHeight()*scale));
                graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                graphics.drawImage(logo,(qr.getWidth()-width)/2,qr.getHeight()+(96-height)/2,width,height,null);
            } else {
                graphics.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                Font font=FontHolder.FONT.deriveFont(30f);
                graphics.setFont(font);
                while (graphics.getFontMetrics().stringWidth(text)>qr.getWidth()-48 && font.getSize()>14) {
                    font=font.deriveFont((float)font.getSize()-1); graphics.setFont(font);
                }
                String label=text;
                while (graphics.getFontMetrics().stringWidth(label)>qr.getWidth()-48 && !label.isEmpty())
                    label=label.substring(0,label.offsetByCodePoints(0,label.codePointCount(0,label.length())-1));
                var metrics=graphics.getFontMetrics();
                graphics.setColor(new Color(64,64,64));
                graphics.drawString(label,(qr.getWidth()-metrics.stringWidth(label))/2,
                    qr.getHeight()+(96-metrics.getHeight())/2+metrics.getAscent());
            }
        } finally { graphics.dispose(); }
        return result;
    }

    private static class FontHolder {
        static final Font FONT=load();
        private static Font load() {
            try (InputStream input=QrWatermark.class.getResourceAsStream("/fonts/NotoSansThai.ttf")) {
                if (input==null) throw new IOException("Missing watermark font");
                return Font.createFont(Font.TRUETYPE_FONT,input);
            } catch (IOException | FontFormatException error) {
                throw new TopupException("PROMPTPAY_QR_FAILED","Could not load QR watermark font",TopupException.Kind.CONFIGURATION);
            }
        }
    }
    private static IllegalArgumentException invalid(String message) { return new IllegalArgumentException(message); }
}
