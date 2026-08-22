-- Support stable keyset pagination and the runtime bootstrap hot path.
CREATE INDEX bot_instances_owner_created_active_idx
    ON bots.bot_instances (owner_user_id, created_at, id)
    WHERE status <> 'DECOMMISSIONED';

CREATE INDEX bot_instances_admin_created_idx
    ON bots.bot_instances (created_at DESC, id DESC);

CREATE INDEX profiles_created_idx
    ON public.profiles (created_at DESC, id DESC);

CREATE INDEX runtime_subscriptions_created_idx
    ON private.runtime_subscriptions (created_at DESC, id DESC);

CREATE INDEX wallet_entries_wallet_created_id_idx
    ON billing.wallet_entries (wallet_id, created_at DESC, id DESC);

CREATE INDEX projects_published_cursor_idx
    ON portfolio.projects (
        is_featured DESC,
        featured_order ASC NULLS LAST,
        published_at DESC,
        slug ASC,
        id
    )
    WHERE publication_status = 'PUBLISHED';
