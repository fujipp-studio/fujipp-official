package com.fujipp.backend.store;

import java.util.Set;

/** Shared status semantics; only startup may be retried, never a customer operation. */
public final class FeatureFailurePolicy {
    public static final Set<String> CATEGORIES = Set.of("CONFIGURATION", "PERMISSION", "TRANSIENT", "INTERNAL");
    private FeatureFailurePolicy() {}

    public static String category(String supplied, String code, String message) {
        if (code == null || code.isBlank()) return null;
        if (supplied != null && CATEGORIES.contains(supplied)) return supplied;
        String text = (code + " " + (message == null ? "" : message)).toLowerCase(java.util.Locale.ROOT);
        if (text.matches("(?s).*(\\b(?:50013|50001)\\b|missing permissions|missing access|disallowed intents|permission denied|eacces).*")) return "PERMISSION";
        if (text.matches("(?s).*(etimedout|econnreset|econnrefused|enotfound|eai_again|fetch failed|socket hang up|timed out|timeout|\\b(?:429|502|503|504)\\b|temporarily unavailable).*")) return "TRANSIENT";
        if (text.matches("(?s).*(required|must be|invalid|not configured|not bundled|configuration|configur[ea]|unknown channel|unknown role).*")) return "CONFIGURATION";
        return "INTERNAL";
    }

    public static String safeMessage(String input) {
        if (input == null) return null;
        String text = input.split("\\n\\s*at ", 2)[0]
            .replaceAll("(?i)postgres(?:ql)?://[^\\s<>\"']+", "[database connection]")
            .replaceAll("(?i)(https?://)[^\\s/@]+:[^\\s/@]+@", "$1[credentials]@")
            .replaceAll("(?i)\\b(Bearer|Bot)\\s+[A-Za-z0-9._-]{20,}", "$1 [redacted]")
            .replaceAll("\\b[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{6,}\\.[A-Za-z0-9_-]{20,}\\b", "[redacted]")
            .replaceAll("(?:AIza|AQ\\.)[A-Za-z0-9_.-]+", "[redacted]")
            .replaceAll("(?i)((?:password|token|secret|cookie|authorization|api[_-]?key)\\s*[=:]\\s*)[^\\s,;]+", "$1[redacted]")
            .replaceAll("(?i)([?&](?:key|token|secret|password|api[_-]?key)=)[^\\s&#]+", "$1[redacted]");
        return text.substring(0, Math.min(text.length(), 2000));
    }

    public static String hint(String category) {
        if (category == null) return "";
        return switch (category) {
            case "CONFIGURATION" -> "แก้การตั้งค่าที่ระบุ แล้วบันทึกเพื่อลองเริ่มฟีเจอร์ใหม่";
            case "PERMISSION" -> "ตรวจสิทธิ์ของบอทในห้องและลำดับยศ แล้วลองเริ่มใหม่";
            case "TRANSIENT" -> "บริการขัดข้องชั่วคราว ระบบจะลองเริ่มใหม่เฉพาะกรณีที่ปลอดภัย";
            default -> "ดูรายละเอียดและติดต่อผู้ดูแล หากเกี่ยวกับเงินให้ตรวจประวัติรายการก่อน";
        };
    }
}
