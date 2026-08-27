package com.fujipp.backend.topup;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
class TopupRepository {
    private final JdbcTemplate jdbc;

    TopupRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    Optional<CustomerWallet> wallet(UUID userId) {
        return jdbc.query("""
                SELECT c.id,w.id,w.balance_satang
                  FROM billing.customers c
                  JOIN billing.wallets w ON w.customer_id=c.id AND w.currency='THB'
                 WHERE c.user_id=? AND c.status='ACTIVE' AND w.status='ACTIVE'
                """, (rs,n) -> new CustomerWallet(
                rs.getObject(1,UUID.class), rs.getObject(2,UUID.class), rs.getLong(3)), userId
        ).stream().findFirst();
    }

    @Transactional
    Invoice create(UUID userId, long amountSatang, String idempotencyKey, String qrPayload, int expiryMinutes) {
        List<Invoice> existing = jdbc.query(INVOICE_SELECT + " WHERE i.idempotency_key=?", this::mapInvoice, idempotencyKey);
        if (!existing.isEmpty()) {
            Invoice invoice = existing.getFirst();
            if (!invoice.userId().equals(userId) || invoice.amountSatang() != amountSatang) {
                throw new TopupException("IDEMPOTENCY_CONFLICT", "Idempotency key was used for another top-up", TopupException.Kind.CONFLICT);
            }
            return invoice;
        }

        CustomerWallet wallet = wallet(userId).orElseThrow(() -> new TopupException(
                "WALLET_NOT_FOUND", "Active THB wallet was not found", TopupException.Kind.NOT_FOUND));
        UUID id = UUID.randomUUID();
        String number = "TPU_" + id.toString().replace("-", "").toUpperCase();
        try {
            jdbc.update("""
                    INSERT INTO billing.topup_invoices
                      (id,invoice_number,customer_id,wallet_id,amount_satang,qr_payload,idempotency_key,expires_at)
                    VALUES (?,?,?,?,?,?,?,now()+(? * interval '1 minute'))
                    """, id,number,wallet.customerId(),wallet.walletId(),amountSatang,qrPayload,idempotencyKey,expiryMinutes);
        } catch (DataIntegrityViolationException exception) {
            throw new TopupException("TOPUP_CONFLICT", "Could not create the top-up invoice", TopupException.Kind.CONFLICT);
        }
        return owned(id,userId).orElseThrow();
    }

    Optional<Invoice> owned(UUID invoiceId, UUID userId) {
        expire(invoiceId);
        return jdbc.query(INVOICE_SELECT + " WHERE i.id=? AND c.user_id=?", this::mapInvoice, invoiceId,userId)
                .stream().findFirst();
    }

    @Transactional
    List<Invoice> list(UUID userId, OffsetDateTime beforeCreatedAt, UUID beforeId, int limit) {
        jdbc.update("""
                UPDATE billing.topup_invoices i SET status='EXPIRED'
                 FROM billing.customers c
                 WHERE i.customer_id=c.id AND c.user_id=? AND i.status IN ('PENDING','FAILED')
                   AND i.expires_at<=now()
                """, userId);
        String cursor=beforeCreatedAt==null?"":" AND (i.created_at,i.id)<(?,?)";
        String sql=INVOICE_SELECT+" WHERE c.user_id=?"+cursor+" ORDER BY i.created_at DESC,i.id DESC LIMIT ?";
        return beforeCreatedAt==null
                ? jdbc.query(sql,this::mapInvoice,userId,limit)
                : jdbc.query(sql,this::mapInvoice,userId,beforeCreatedAt,beforeId,limit);
    }

    @Transactional
    Verification beginVerification(UUID invoiceId, UUID userId, String slipFingerprint) {
        Invoice invoice = jdbc.query(INVOICE_SELECT + " WHERE i.id=? AND c.user_id=? FOR UPDATE", this::mapInvoice, invoiceId,userId)
                .stream().findFirst().orElseThrow(() -> new TopupException(
                        "TOPUP_NOT_FOUND", "Top-up invoice was not found", TopupException.Kind.NOT_FOUND));
        if (invoice.expiresAt().isBefore(OffsetDateTime.now())) {
            expire(invoiceId);
            throw new TopupException("TOPUP_EXPIRED", "Top-up invoice has expired", TopupException.Kind.CONFLICT);
        }
        if ("SUCCESS".equals(invoice.status())) {
            throw new TopupException("TOPUP_ALREADY_COMPLETED", "Top-up invoice is already completed", TopupException.Kind.CONFLICT);
        }
        if ("VERIFYING".equals(invoice.status())) {
            throw new TopupException("TOPUP_VERIFYING", "A slip is already being verified", TopupException.Kind.CONFLICT);
        }
        if (!List.of("PENDING","FAILED").contains(invoice.status())) {
            throw new TopupException("TOPUP_NOT_PAYABLE", "Top-up invoice cannot accept a slip", TopupException.Kind.CONFLICT);
        }

        Integer attempt = jdbc.queryForObject(
                "SELECT COALESCE(max(attempt_number),0)+1 FROM billing.slip_verifications WHERE topup_invoice_id=?",
                Integer.class, invoiceId);
        UUID verificationId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO billing.slip_verifications
                  (id,topup_invoice_id,attempt_number,status,slip_storage_path,verification_started_at)
                VALUES (?,?,?,'VERIFYING',?,now())
                """, verificationId,invoiceId,attempt,slipFingerprint);
        jdbc.update("UPDATE billing.topup_invoices SET status='VERIFYING',verifying_at=now(),failure_code=NULL,failure_message=NULL WHERE id=?", invoiceId);
        return new Verification(verificationId, invoice);
    }

    @Transactional
    Invoice complete(Verification verification, SlipOkClient.Result result) {
        jdbc.update("""
                UPDATE billing.slip_verifications
                   SET status='VERIFIED',transaction_reference=?,transaction_at=?,sending_bank_code=?,
                       receiving_bank_code=?,sender_display_name=?,receiver_display_name=?,
                       verified_amount_satang=?,slipok_response=?::jsonb,verified_at=now()
                 WHERE id=? AND status='VERIFYING'
                """, result.reference(),result.transactionAt(),result.sendingBank(),result.receivingBank(),
                result.senderName(),result.receiverName(),result.amountSatang(),result.rawJson(),verification.id());
        jdbc.queryForObject("SELECT id FROM billing.complete_slipok_topup(?,?)", UUID.class,
                verification.invoice().id(), verification.id());
        return owned(verification.invoice().id(), verification.invoice().userId()).orElseThrow();
    }

    @Transactional
    void reject(Verification verification, String code, String message, boolean upstreamError) {
        jdbc.update("""
                UPDATE billing.slip_verifications
                   SET status=?::billing.slip_verification_status,slipok_error_code=?,slipok_message=?,rejected_at=now()
                 WHERE id=? AND status='VERIFYING'
                """, upstreamError ? "ERROR" : "REJECTED",code,message,verification.id());
        jdbc.update("""
                UPDATE billing.topup_invoices
                   SET status='FAILED',failed_at=now(),failure_code=?,failure_message=?
                 WHERE id=? AND status='VERIFYING'
                """,code,message,verification.invoice().id());
    }

    private void expire(UUID invoiceId) {
        jdbc.update("""
                UPDATE billing.topup_invoices SET status='EXPIRED'
                 WHERE id=? AND status IN ('PENDING','FAILED') AND expires_at<=now()
                """, invoiceId);
    }

    private Invoice mapInvoice(java.sql.ResultSet rs, int row) throws java.sql.SQLException {
        return new Invoice(rs.getObject("id",UUID.class),rs.getString("invoice_number"),
                rs.getObject("user_id",UUID.class),rs.getLong("amount_satang"),rs.getString("currency"),
                rs.getString("status"),rs.getString("qr_payload"),rs.getLong("balance_satang"),
                rs.getObject("expires_at",OffsetDateTime.class),rs.getObject("succeeded_at",OffsetDateTime.class),
                rs.getObject("created_at",OffsetDateTime.class));
    }

    private static final String INVOICE_SELECT = """
            SELECT i.id,i.invoice_number,c.user_id,i.amount_satang,i.currency,i.status,i.qr_payload,
                   w.balance_satang,i.expires_at,i.succeeded_at,i.created_at
              FROM billing.topup_invoices i
              JOIN billing.customers c ON c.id=i.customer_id
              JOIN billing.wallets w ON w.id=i.wallet_id
            """;

    record CustomerWallet(UUID customerId, UUID walletId, long balanceSatang) {}
    record Invoice(UUID id,String invoiceNumber,UUID userId,long amountSatang,String currency,String status,
                   String qrPayload,long balanceSatang,OffsetDateTime expiresAt,OffsetDateTime succeededAt,
                   OffsetDateTime createdAt) {}
    record Verification(UUID id, Invoice invoice) {}
}
