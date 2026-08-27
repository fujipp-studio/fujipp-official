package com.fujipp.backend.topup;

import com.fujipp.backend.pagination.CursorCodec;
import com.fujipp.backend.pagination.CursorPage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Locale;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
class TopupService {
    private static final Set<String> TYPES = Set.of("image/jpeg","image/png","image/webp");
    private static final Set<String> EXTENSIONS = Set.of("jpg","jpeg","png","jfif","webp");

    private final TopupRepository repository;
    private final SlipOkClient slipOk;
    private final PromptPayQrGenerator promptPayQr;
    private final String promptPayId;
    private final String accountName;
    private final long minimumSatang;
    private final long maximumSatang;
    private final long maxFileBytes;
    private final int expiryMinutes;
    private final CursorCodec cursors;

    TopupService(TopupRepository repository, SlipOkClient slipOk, PromptPayQrGenerator promptPayQr, CursorCodec cursors,
            @Value("${app.topup.promptpay-id:}") String promptPayId,
            @Value("${app.topup.account-name:}") String accountName,
            @Value("${app.topup.minimum-satang:1000}") long minimumSatang,
            @Value("${app.topup.maximum-satang:10000000}") long maximumSatang,
            @Value("${app.topup.max-slip-file-bytes:5242880}") long maxFileBytes,
            @Value("${app.topup.expiry-minutes:15}") int expiryMinutes) {
        this.repository=repository; this.slipOk=slipOk; this.promptPayQr=promptPayQr; this.promptPayId=promptPayId;
        this.accountName=accountName; this.minimumSatang=minimumSatang; this.maximumSatang=maximumSatang;
        this.maxFileBytes=maxFileBytes; this.expiryMinutes=Math.max(1,Math.min(60,expiryMinutes)); this.cursors=cursors;
    }

    TopupResponses.Invoice create(String subject, TopupRequests.Create request) {
        requireConfigured();
        if (request.amountSatang()<minimumSatang || request.amountSatang()>maximumSatang) {
            throw new TopupException("INVALID_TOPUP_AMOUNT",
                    "Top-up amount must be between configured minimum and maximum", TopupException.Kind.VALIDATION);
        }
        PromptPayQrGenerator.PaymentQr qr = promptPayQr.generate(promptPayId, request.amountSatang());
        return response(repository.create(userId(subject),request.amountSatang(),request.idempotencyKey(),qr.payload(),expiryMinutes));
    }

    TopupResponses.Invoice get(String subject, UUID invoiceId) {
        requireConfigured();
        return response(repository.owned(invoiceId,userId(subject)).orElseThrow(() -> new TopupException(
                "TOPUP_NOT_FOUND", "Top-up invoice was not found", TopupException.Kind.NOT_FOUND)));
    }

    CursorPage<TopupResponses.Summary> list(String subject, int requestedLimit, String cursor) {
        requireConfigured();
        UUID userId=userId(subject);
        int limit=Math.max(1,Math.min(50,requestedLimit));
        var values=cursors.decode(cursor,"website-topups",userId.toString(),2);
        OffsetDateTime createdAt=values.isEmpty()?null:cursors.dateTime(values.get(0));
        UUID invoiceId=values.isEmpty()?null:cursors.uuid(values.get(1));
        List<TopupRepository.Invoice> rows=repository.list(userId,createdAt,invoiceId,limit+1);
        var page=CursorPage.of(rows,limit,row->cursors.encode("website-topups",userId.toString(),
                List.of(row.createdAt().toString(),row.id().toString())));
        return new CursorPage<>(page.items().stream().map(this::summary).toList(),page.nextCursor(),page.hasMore());
    }

    TopupResponses.Invoice verify(String subject, UUID invoiceId, MultipartFile file) {
        requireConfigured();
        byte[] bytes=validateAndRead(file);
        TopupRepository.Verification verification=repository.beginVerification(invoiceId,userId(subject),"sha256:"+sha256(bytes));
        try {
            MediaType type=MediaType.parseMediaType(file.getContentType());
            SlipOkClient.Result result=slipOk.verify(bytes,file.getOriginalFilename(),type,verification.invoice().amountSatang());
            return response(repository.complete(verification,result));
        } catch (TopupException exception) {
            repository.reject(verification,exception.code(),exception.getMessage(),exception.kind()==TopupException.Kind.UPSTREAM);
            throw exception;
        } catch (RuntimeException exception) {
            repository.reject(verification,"VERIFICATION_ERROR","Slip verification failed",true);
            throw new TopupException("VERIFICATION_ERROR","Slip verification failed",TopupException.Kind.UPSTREAM);
        }
    }

    private byte[] validateAndRead(MultipartFile file) {
        if (file==null || file.isEmpty()) throw invalidFile();
        if (file.getSize()>maxFileBytes) {
            throw new TopupException("SLIP_FILE_TOO_LARGE","Slip image is too large",TopupException.Kind.VALIDATION);
        }
        String contentType=file.getContentType();
        String name=file.getOriginalFilename()==null?"":file.getOriginalFilename();
        int dot=name.lastIndexOf('.');
        String extension=dot<0?"":name.substring(dot+1).toLowerCase(Locale.ROOT);
        if (!TYPES.contains(contentType) || !EXTENSIONS.contains(extension)) throw invalidFile();
        try { return file.getBytes(); }
        catch (IOException exception) {
            throw new TopupException("SLIP_FILE_UNREADABLE","Could not read slip image",TopupException.Kind.VALIDATION);
        }
    }

    private TopupException invalidFile() {
        return new TopupException("INVALID_SLIP_FILE","Slip must be a JPG, PNG, JFIF, or WEBP image",TopupException.Kind.VALIDATION);
    }

    private void requireConfigured() {
        if (promptPayId.isBlank() || accountName.isBlank()) {
            throw new TopupException("TOPUP_NOT_CONFIGURED","Website top-up is not configured",TopupException.Kind.CONFIGURATION);
        }
    }

    private TopupResponses.Invoice response(TopupRepository.Invoice invoice) {
        String image = invoice.qrPayload().startsWith("data:image/") || invoice.qrPayload().startsWith("http")
                ? invoice.qrPayload()
                : promptPayQr.pngDataUri(invoice.qrPayload());
        return new TopupResponses.Invoice(invoice.id(),invoice.invoiceNumber(),invoice.amountSatang(),invoice.currency(),
                invoice.status(),accountName,image,invoice.balanceSatang(),invoice.expiresAt(),invoice.succeededAt(),
                invoice.createdAt());
    }

    private TopupResponses.Summary summary(TopupRepository.Invoice invoice) {
        return new TopupResponses.Summary(invoice.id(),invoice.invoiceNumber(),invoice.amountSatang(),invoice.currency(),
                invoice.status(),invoice.expiresAt(),invoice.succeededAt(),invoice.createdAt());
    }

    private static UUID userId(String subject) {
        try { return UUID.fromString(subject); }
        catch (IllegalArgumentException exception) {
            throw new TopupException("INVALID_AUTHENTICATION","Authenticated user id is invalid",TopupException.Kind.VALIDATION);
        }
    }

    private static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
