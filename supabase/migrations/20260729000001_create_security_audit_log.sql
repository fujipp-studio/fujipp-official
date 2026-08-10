
CREATE TABLE private.security_audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    outcome VARCHAR(20) NOT NULL,
    actor_user_id UUID,
    subject_user_id UUID,
    ip_address INET,
    user_agent VARCHAR(512),
    request_id UUID NOT NULL DEFAULT gen_random_uuid(),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT security_audit_log_event_type_chk CHECK (
        event_type ~ '^[A-Z][A-Z0-9_]{2,99}$'
    ),
    CONSTRAINT security_audit_log_outcome_chk CHECK (
        outcome IN ('SUCCESS', 'DENIED', 'FAILURE')
    ),
    CONSTRAINT security_audit_log_details_object_chk CHECK (
        jsonb_typeof(details) = 'object'
    )
);

CREATE INDEX security_audit_log_created_at_idx
    ON private.security_audit_log (created_at DESC);
CREATE INDEX security_audit_log_event_type_created_at_idx
    ON private.security_audit_log (event_type, created_at DESC);
CREATE INDEX security_audit_log_actor_created_at_idx
    ON private.security_audit_log (actor_user_id, created_at DESC)
    WHERE actor_user_id IS NOT NULL;
CREATE INDEX security_audit_log_subject_created_at_idx
    ON private.security_audit_log (subject_user_id, created_at DESC)
    WHERE subject_user_id IS NOT NULL;

CREATE FUNCTION private.reject_security_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'security audit log is append-only';
END;
$$;

CREATE TRIGGER security_audit_log_reject_mutation
    BEFORE UPDATE OR DELETE ON private.security_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION private.reject_security_audit_log_mutation();

REVOKE ALL ON FUNCTION private.reject_security_audit_log_mutation() FROM PUBLIC;

ALTER TABLE private.security_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.security_audit_log FROM anon, authenticated;
REVOKE ALL ON SEQUENCE private.security_audit_log_id_seq FROM anon, authenticated;

GRANT SELECT, INSERT ON TABLE private.security_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE private.security_audit_log_id_seq TO service_role;

COMMENT ON TABLE private.security_audit_log IS
    'Append-only Backend security events without authentication secrets.';
