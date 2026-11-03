DO $$
BEGIN
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='private'
   AND table_name='bot_feature_installations' AND column_name IN
   ('last_error_category','last_error_at','recovery_attempts','next_retry_at'))<>4
 THEN RAISE EXCEPTION 'Missing feature recovery metadata'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='private.bot_feature_installations'::regclass
   AND conname='feature_recovery_attempts_chk' AND contype='c')
 THEN RAISE EXCEPTION 'Missing recovery retry bound'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='private' AND indexname='bot_feature_recovery_due_idx')
 THEN RAISE EXCEPTION 'Missing recovery due index'; END IF;
 IF EXISTS(SELECT 1 FROM shop.feature_config_definitions d JOIN shop.feature_versions v ON v.id=d.feature_version_id
   JOIN shop.feature_products p ON p.id=v.feature_product_id
   WHERE p.code='bot-presence' AND d.config_key='PRESENCE_ROTATE_SECONDS' AND (d.validation_schema->>'minimum')::numeric IS DISTINCT FROM 20)
 THEN RAISE EXCEPTION 'Presence catalog minimum must match runtime'; END IF;
END $$;
