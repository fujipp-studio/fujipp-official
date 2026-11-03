-- Expand-only diagnostic metadata. Existing status writers remain compatible.
ALTER TABLE private.bot_feature_installations
 ADD COLUMN last_error_category text,
 ADD COLUMN last_error_at timestamptz,
 ADD COLUMN recovery_attempts integer NOT NULL DEFAULT 0,
 ADD COLUMN next_retry_at timestamptz,
 ADD CONSTRAINT feature_error_category_chk CHECK (last_error_category IS NULL OR last_error_category IN ('CONFIGURATION','PERMISSION','TRANSIENT','INTERNAL')),
 ADD CONSTRAINT feature_recovery_attempts_chk CHECK (recovery_attempts BETWEEN 0 AND 3);

CREATE INDEX bot_feature_recovery_due_idx ON private.bot_feature_installations(next_retry_at)
 WHERE status='ERROR' AND removed_at IS NULL AND next_retry_at IS NOT NULL;

-- Match the runtime's existing minimum; saved customer values are not rewritten.
UPDATE shop.feature_config_definitions d
 SET validation_schema=jsonb_set(coalesce(d.validation_schema,'{}'::jsonb),'{minimum}','20'::jsonb)
 FROM shop.feature_versions v JOIN shop.feature_products p ON p.id=v.feature_product_id
 WHERE d.feature_version_id=v.id AND p.code='bot-presence' AND d.config_key='PRESENCE_ROTATE_SECONDS';
