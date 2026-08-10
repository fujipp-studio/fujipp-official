ALTER TABLE shop.feature_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.feature_runtime_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.member_spending ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    shop.feature_actions,
    private.feature_runtime_states,
    private.member_spending
FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE
    shop.feature_actions,
    private.feature_runtime_states,
    private.member_spending
TO service_role;
