SELECT (SELECT count(*) FROM private.member_wallets WHERE bot_id=?) customers,
  (SELECT COALESCE(sum(balance_satang),0)::text FROM private.member_wallets WHERE bot_id=?) balance,
  COALESCE(sum(amount_satang) FILTER (WHERE method='TRUEMONEY'),0)::text truemoney,
  COALESCE(sum(amount_satang) FILTER (WHERE method='SLIPOK'),0)::text slipok,
  (SELECT count(*) FROM private.truemoney_voucher_redemptions
    WHERE bot_id=? AND wallet_flow_version=2 AND
    (status='RECONCILIATION_REQUIRED' OR (status='SUCCEEDED' AND wallet_ledger_id IS NULL)
      OR (status='REDEEMING' AND processing_started_at<now()-interval '2 minutes'))) review
FROM private.member_wallet_entries WHERE bot_id=? AND kind='TOPUP'
