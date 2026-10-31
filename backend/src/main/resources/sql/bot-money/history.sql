WITH history AS (
  SELECT e.id,e.member_discord_id,e.method::text provider,'CREDITED'::text status,
    COALESCE(r.amount_satang::text,e.metadata->>'grossSatang',
      CASE WHEN e.method='SLIPOK' THEN e.amount_satang::text END) gross,
    CASE WHEN r.amount_satang>=e.amount_satang THEN (r.amount_satang-e.amount_satang)::text
      WHEN e.method='SLIPOK' THEN '0' ELSE e.metadata->>'feeSatang' END fee,e.amount_satang::text credited,
    e.source_reference reference,NULL::text failure_code,
    (e.method='TRUEMONEY' AND r.wallet_flow_version IS NULL) legacy,e.created_at
  FROM private.member_wallet_entries e
  LEFT JOIN LATERAL (SELECT amount_satang,wallet_flow_version FROM private.truemoney_voucher_redemptions r
    WHERE r.bot_id=e.bot_id AND r.member_discord_id=e.member_discord_id AND r.status='SUCCEEDED'
      AND r.payment_message_id IS NULL AND (r.wallet_ledger_id=e.id
        OR (r.wallet_ledger_id IS NULL AND r.upstream_reference=e.source_reference))
    ORDER BY r.created_at DESC LIMIT 1) r ON true
  WHERE e.bot_id=? AND e.kind='TOPUP'
  UNION ALL
  SELECT r.id,r.member_discord_id,'TRUEMONEY',
    CASE WHEN r.wallet_flow_version IS NULL THEN 'LEGACY_RECORD'
      WHEN r.status='SUCCEEDED' THEN 'RECEIVED_PENDING_CREDIT'
      WHEN r.status='RECONCILIATION_REQUIRED' OR
        (r.status='REDEEMING' AND r.processing_started_at<now()-interval '2 minutes') THEN 'REVIEW_REQUIRED'
      WHEN r.status='REDEEMING' THEN 'PROCESSING' ELSE 'REJECTED' END,
    r.amount_satang::text,NULL::text,NULL::text,r.upstream_reference,r.failure_code,
    r.wallet_flow_version IS NULL,r.created_at
  FROM private.truemoney_voucher_redemptions r
  WHERE r.bot_id=? AND r.payment_message_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM private.member_wallet_entries e WHERE e.bot_id=r.bot_id
      AND e.member_discord_id=r.member_discord_id AND e.kind='TOPUP' AND e.method='TRUEMONEY'
      AND (e.id=r.wallet_ledger_id OR e.source_reference=r.upstream_reference))
) SELECT * FROM history WHERE (?::text IS NULL OR member_discord_id=?)
  AND (?::text IS NULL OR provider=?)
  AND (NOT ? OR status IN ('RECEIVED_PENDING_CREDIT','REVIEW_REQUIRED'))
