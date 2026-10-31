SELECT w.member_discord_id,w.balance_satang::text,
  COALESCE(t.total,0)::text,t.last_topup
FROM private.member_wallets w
LEFT JOIN LATERAL (SELECT sum(amount_satang) total,max(created_at) last_topup
  FROM private.member_wallet_entries e WHERE e.bot_id=w.bot_id
    AND e.member_discord_id=w.member_discord_id AND e.kind='TOPUP') t ON true
WHERE w.bot_id=? AND w.member_discord_id>?
  AND (?::text IS NULL OR w.member_discord_id=?)
ORDER BY w.member_discord_id LIMIT ?
