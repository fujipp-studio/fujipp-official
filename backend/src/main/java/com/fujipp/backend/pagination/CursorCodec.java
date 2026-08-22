package com.fujipp.backend.pagination;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.time.OffsetDateTime;
import java.math.BigDecimal;

@Component
public class CursorCodec {
    private static final int VERSION = 1;
    private final ObjectMapper json;

    public CursorCodec(ObjectMapper json) { this.json = json; }

    public String encode(String scope, String filter, List<String> values) {
        try {
            byte[] bytes = json.writeValueAsBytes(new Payload(VERSION, scope, fingerprint(filter), values));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to encode cursor", exception);
        }
    }

    public List<String> decode(String value, String scope, String filter, int expectedValues) {
        if (value == null || value.isBlank()) return List.of();
        try {
            Payload payload = json.readValue(Base64.getUrlDecoder().decode(value), Payload.class);
            if (payload.version() != VERSION || !scope.equals(payload.scope())
                    || !fingerprint(filter).equals(payload.fingerprint())
                    || payload.values() == null || payload.values().size() != expectedValues) {
                throw new IllegalArgumentException();
            }
            return List.copyOf(payload.values());
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination cursor");
        }
    }

    public UUID uuid(String value) {
        try { return UUID.fromString(value); }
        catch (RuntimeException exception) { throw invalid(); }
    }

    public OffsetDateTime dateTime(String value) {
        try { return OffsetDateTime.parse(value); }
        catch (RuntimeException exception) { throw invalid(); }
    }

    public int integer(String value) {
        try { return Integer.parseInt(value); }
        catch (RuntimeException exception) { throw invalid(); }
    }

    public long longValue(String value) {
        try { return Long.parseLong(value); }
        catch (RuntimeException exception) { throw invalid(); }
    }

    public BigDecimal decimal(String value) {
        try { return new BigDecimal(value); }
        catch (RuntimeException exception) { throw invalid(); }
    }

    private ResponseStatusException invalid() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination cursor");
    }

    private String fingerprint(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private record Payload(int version, String scope, String fingerprint, List<String> values) {}
}
