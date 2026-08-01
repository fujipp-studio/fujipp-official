-- Bot feature store foundation.
--
-- Ownership (a license) is deliberately separate from assignment (an
-- installation). A purchased feature can therefore remain in a customer's
-- inventory while it is not assigned to any bot. Catalog, commerce, runtime
-- configuration, and encrypted secrets also live in separate schemas.

CREATE SCHEMA shop;
CREATE SCHEMA bots;

CREATE TYPE shop.feature_product_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'ARCHIVED'
);

CREATE TYPE shop.feature_version_status AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'DEPRECATED'
);

CREATE TYPE shop.feature_offer_kind AS ENUM (
    'ONE_TIME',
    'SUBSCRIPTION'
);

CREATE TYPE shop.feature_config_value_type AS ENUM (
    'STRING',
    'TEXT',
    'INTEGER',
    'DECIMAL',
    'BOOLEAN',
    'CHANNEL_ID',
    'ROLE_ID',
    'USER_ID',
    'ENUM',
    'STRING_LIST',
    'JSON',
    'SECRET'
);

CREATE TYPE shop.presentation_type AS ENUM (
    'MESSAGE',
    'EMBED',
    'COMPONENTS_V2'
);

CREATE TYPE bots.bot_status AS ENUM (
    'CREATED',
    'READY',
    'RUNNING',
    'STOPPED',
    'SUSPENDED',
    'CRASHED',
    'DECOMMISSIONED'
);

CREATE TYPE billing.store_order_status AS ENUM (
    'PENDING',
    'PAID',
    'CANCELLED',
    'FAILED',
    'REFUNDED'
);

CREATE TYPE private.feature_license_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'REVOKED',
    'EXPIRED'
);

CREATE TYPE private.feature_license_source AS ENUM (
    'PURCHASE',
    'GRANT'
);

CREATE TYPE private.feature_installation_status AS ENUM (
    'INSTALLING',
    'ACTIVE',
    'DISABLED',
    'ERROR',
    'REMOVED'
);

-- Customer-owned Discord bots. Secrets are kept out of this registry.
CREATE TABLE bots.bot_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL
        REFERENCES auth.users (id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    discord_application_id VARCHAR(30),
    discord_guild_id VARCHAR(30),
    discord_username VARCHAR(100),
    discord_avatar_url TEXT,
    status bots.bot_status NOT NULL DEFAULT 'CREATED',
    last_started_at TIMESTAMPTZ,
    last_stopped_at TIMESTAMPTZ,
    decommissioned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT bot_instances_owner_name_key
        UNIQUE (owner_user_id, name),
    CONSTRAINT bot_instances_id_owner_key
        UNIQUE (id, owner_user_id),
    CONSTRAINT bot_instances_application_key
        UNIQUE (discord_application_id),
    CONSTRAINT bot_instances_application_format_chk CHECK (
        discord_application_id IS NULL
        OR discord_application_id ~ '^[0-9]{15,30}$'
    ),
    CONSTRAINT bot_instances_guild_format_chk CHECK (
        discord_guild_id IS NULL
        OR discord_guild_id ~ '^[0-9]{15,30}$'
    ),
    CONSTRAINT bot_instances_avatar_url_chk CHECK (
        discord_avatar_url IS NULL
        OR discord_avatar_url ~ '^https://'
    ),
    CONSTRAINT bot_instances_decommissioned_chk CHECK (
        (status = 'DECOMMISSIONED' AND decommissioned_at IS NOT NULL)
        OR (status <> 'DECOMMISSIONED' AND decommissioned_at IS NULL)
    )
);

CREATE INDEX bot_instances_owner_status_idx
    ON bots.bot_instances (owner_user_id, status);

-- Public product identity. Published behavior belongs to an immutable version.
CREATE TABLE shop.feature_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category VARCHAR(60) NOT NULL,
    icon_key VARCHAR(100),
    image_public_id VARCHAR(255),
    image_url TEXT,
    image_width INTEGER,
    image_height INTEGER,
    image_format VARCHAR(20),
    image_bytes BIGINT,
    image_alt_text VARCHAR(255),
    tutorial_url TEXT,
    status shop.feature_product_status NOT NULL DEFAULT 'DRAFT',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_products_code_format_chk CHECK (
        code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
    CONSTRAINT feature_products_name_chk CHECK (
        char_length(btrim(name)) BETWEEN 1 AND 150
    ),
    CONSTRAINT feature_products_category_chk CHECK (
        category ~ '^[A-Z][A-Z0-9_]{1,59}$'
    ),
    CONSTRAINT feature_products_image_pair_chk CHECK (
        (image_public_id IS NULL) = (image_url IS NULL)
    ),
    CONSTRAINT feature_products_image_url_chk CHECK (
        image_url IS NULL OR image_url ~ '^https://'
    ),
    CONSTRAINT feature_products_image_dimensions_chk CHECK (
        (image_width IS NULL OR image_width > 0)
        AND (image_height IS NULL OR image_height > 0)
        AND (image_bytes IS NULL OR image_bytes > 0)
    ),
    CONSTRAINT feature_products_tutorial_url_chk CHECK (
        tutorial_url IS NULL
        OR tutorial_url ~ '^https://(www\.)?(youtube\.com/(watch\?|shorts/)|youtu\.be/)'
    ),
    CONSTRAINT feature_products_sort_order_chk CHECK (sort_order >= 0)
);

CREATE INDEX feature_products_catalog_idx
    ON shop.feature_products (status, is_featured DESC, sort_order);

CREATE TABLE shop.feature_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_product_id UUID NOT NULL
        REFERENCES shop.feature_products (id) ON DELETE RESTRICT,
    version VARCHAR(40) NOT NULL,
    runtime_key VARCHAR(120) NOT NULL,
    changelog TEXT,
    status shop.feature_version_status NOT NULL DEFAULT 'DRAFT',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_versions_product_version_key
        UNIQUE (feature_product_id, version),
    CONSTRAINT feature_versions_id_product_key
        UNIQUE (id, feature_product_id),
    CONSTRAINT feature_versions_runtime_key_chk CHECK (
        runtime_key ~ '^[a-z0-9]+(?:[._-][a-z0-9]+)*$'
    ),
    CONSTRAINT feature_versions_version_chk CHECK (
        version ~ '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$'
    ),
    CONSTRAINT feature_versions_publication_chk CHECK (
        (status = 'DRAFT' AND published_at IS NULL)
        OR (status IN ('PUBLISHED', 'DEPRECATED') AND published_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX feature_versions_one_published_key
    ON shop.feature_versions (feature_product_id)
    WHERE status = 'PUBLISHED';

CREATE TABLE shop.feature_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_product_id UUID NOT NULL
        REFERENCES shop.feature_products (id) ON DELETE RESTRICT,
    code VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    offer_kind shop.feature_offer_kind NOT NULL,
    price_satang BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    billing_period_days INTEGER,
    installation_limit INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_offers_product_code_key
        UNIQUE (feature_product_id, code),
    CONSTRAINT feature_offers_id_product_key
        UNIQUE (id, feature_product_id),
    CONSTRAINT feature_offers_code_format_chk CHECK (
        code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    ),
    CONSTRAINT feature_offers_price_chk CHECK (price_satang > 0),
    CONSTRAINT feature_offers_currency_chk CHECK (currency = 'THB'),
    CONSTRAINT feature_offers_installation_limit_chk
        CHECK (installation_limit > 0),
    CONSTRAINT feature_offers_billing_period_chk CHECK (
        (offer_kind = 'ONE_TIME' AND billing_period_days IS NULL)
        OR (offer_kind = 'SUBSCRIPTION' AND billing_period_days > 0)
    ),
    CONSTRAINT feature_offers_availability_chk CHECK (
        starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
    )
);

CREATE INDEX feature_offers_active_idx
    ON shop.feature_offers (feature_product_id, is_active);

-- Each definition drives both backend validation and the configuration UI.
CREATE TABLE shop.feature_config_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_version_id UUID NOT NULL
        REFERENCES shop.feature_versions (id) ON DELETE CASCADE,
    config_key VARCHAR(120) NOT NULL,
    label VARCHAR(150) NOT NULL,
    description TEXT,
    value_type shop.feature_config_value_type NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_secret BOOLEAN NOT NULL DEFAULT false,
    default_value JSONB,
    validation_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    ui_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_config_definitions_version_key
        UNIQUE (feature_version_id, config_key),
    CONSTRAINT feature_config_definitions_id_version_key
        UNIQUE (id, feature_version_id),
    CONSTRAINT feature_config_definitions_key_format_chk CHECK (
        config_key ~ '^[A-Z][A-Z0-9_]{1,119}$'
    ),
    CONSTRAINT feature_config_definitions_secret_type_chk CHECK (
        is_secret = (value_type = 'SECRET')
    ),
    CONSTRAINT feature_config_definitions_secret_default_chk CHECK (
        is_secret = false OR default_value IS NULL
    ),
    CONSTRAINT feature_config_definitions_schema_chk CHECK (
        jsonb_typeof(validation_schema) = 'object'
        AND jsonb_typeof(ui_metadata) = 'object'
    ),
    CONSTRAINT feature_config_definitions_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE TABLE shop.feature_presentation_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_version_id UUID NOT NULL
        REFERENCES shop.feature_versions (id) ON DELETE CASCADE,
    slot_key VARCHAR(120) NOT NULL,
    label VARCHAR(150) NOT NULL,
    description TEXT,
    presentation_type shop.presentation_type NOT NULL,
    available_variables TEXT[] NOT NULL DEFAULT '{}',
    default_definition JSONB NOT NULL,
    validation_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_presentation_slots_version_key
        UNIQUE (feature_version_id, slot_key),
    CONSTRAINT feature_presentation_slots_id_version_key
        UNIQUE (id, feature_version_id),
    CONSTRAINT feature_presentation_slots_key_format_chk CHECK (
        slot_key ~ '^[a-z][a-z0-9_]{1,119}$'
    ),
    CONSTRAINT feature_presentation_slots_definition_chk CHECK (
        jsonb_typeof(default_definition) = 'object'
        AND jsonb_typeof(validation_schema) = 'object'
    ),
    CONSTRAINT feature_presentation_slots_sort_order_chk
        CHECK (sort_order >= 0)
);

-- Store receipts. Financial debits remain append-only in billing.wallet_entries.
CREATE TABLE billing.store_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(40) NOT NULL UNIQUE,
    customer_id UUID NOT NULL
        REFERENCES billing.customers (id) ON DELETE RESTRICT,
    status billing.store_order_status NOT NULL DEFAULT 'PENDING',
    total_satang BIGINT NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'THB',
    idempotency_key VARCHAR(150) NOT NULL UNIQUE,
    wallet_entry_id UUID UNIQUE
        REFERENCES billing.wallet_entries (id) ON DELETE RESTRICT,
    refund_wallet_entry_id UUID UNIQUE
        REFERENCES billing.wallet_entries (id) ON DELETE RESTRICT,
    failure_code VARCHAR(60),
    failure_message TEXT,
    paid_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT store_orders_number_format_chk CHECK (
        order_number ~ '^ORD_[A-F0-9]{32}$'
    ),
    CONSTRAINT store_orders_total_chk CHECK (total_satang > 0),
    CONSTRAINT store_orders_currency_chk CHECK (currency = 'THB'),
    CONSTRAINT store_orders_status_fields_chk CHECK (
        (status <> 'PAID' OR (wallet_entry_id IS NOT NULL AND paid_at IS NOT NULL))
        AND (status <> 'CANCELLED' OR cancelled_at IS NOT NULL)
        AND (status <> 'FAILED' OR failed_at IS NOT NULL)
        AND (
            status <> 'REFUNDED'
            OR (
                wallet_entry_id IS NOT NULL
                AND refund_wallet_entry_id IS NOT NULL
                AND paid_at IS NOT NULL
                AND refunded_at IS NOT NULL
            )
        )
    )
);

CREATE INDEX store_orders_customer_created_idx
    ON billing.store_orders (customer_id, created_at DESC);

CREATE TABLE billing.store_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL
        REFERENCES billing.store_orders (id) ON DELETE RESTRICT,
    feature_offer_id UUID NOT NULL
        REFERENCES shop.feature_offers (id) ON DELETE RESTRICT,
    feature_product_id UUID NOT NULL,
    feature_version_id UUID NOT NULL,
    product_code_snapshot VARCHAR(80) NOT NULL,
    product_name_snapshot VARCHAR(150) NOT NULL,
    offer_code_snapshot VARCHAR(80) NOT NULL,
    offer_name_snapshot VARCHAR(150) NOT NULL,
    offer_kind_snapshot shop.feature_offer_kind NOT NULL,
    unit_price_satang BIGINT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total_satang BIGINT NOT NULL,
    installation_limit_snapshot INTEGER NOT NULL,
    billing_period_days_snapshot INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT store_order_items_id_product_version_key
        UNIQUE (id, feature_product_id, feature_version_id),
    CONSTRAINT store_order_items_offer_product_fkey
        FOREIGN KEY (feature_offer_id, feature_product_id)
        REFERENCES shop.feature_offers (id, feature_product_id)
        ON DELETE RESTRICT,
    CONSTRAINT store_order_items_version_product_fkey
        FOREIGN KEY (feature_version_id, feature_product_id)
        REFERENCES shop.feature_versions (id, feature_product_id)
        ON DELETE RESTRICT,
    CONSTRAINT store_order_items_amount_chk CHECK (
        unit_price_satang > 0
        AND quantity > 0
        AND line_total_satang = unit_price_satang * quantity
    ),
    CONSTRAINT store_order_items_installation_limit_chk
        CHECK (installation_limit_snapshot > 0),
    CONSTRAINT store_order_items_billing_period_chk CHECK (
        (offer_kind_snapshot = 'ONE_TIME' AND billing_period_days_snapshot IS NULL)
        OR (
            offer_kind_snapshot = 'SUBSCRIPTION'
            AND billing_period_days_snapshot > 0
        )
    )
);

CREATE INDEX store_order_items_order_idx
    ON billing.store_order_items (order_id);

-- One row is one independently assignable copy in the customer's inventory.
CREATE TABLE private.feature_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL
        REFERENCES auth.users (id) ON DELETE RESTRICT,
    feature_product_id UUID NOT NULL
        REFERENCES shop.feature_products (id) ON DELETE RESTRICT,
    acquired_version_id UUID NOT NULL,
    order_item_id UUID,
    source private.feature_license_source NOT NULL,
    status private.feature_license_status NOT NULL DEFAULT 'ACTIVE',
    installation_limit INTEGER NOT NULL DEFAULT 1,
    granted_by UUID
        REFERENCES auth.users (id) ON DELETE SET NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_licenses_id_owner_key
        UNIQUE (id, owner_user_id),
    CONSTRAINT feature_licenses_id_product_key
        UNIQUE (id, feature_product_id),
    CONSTRAINT feature_licenses_version_product_fkey
        FOREIGN KEY (acquired_version_id, feature_product_id)
        REFERENCES shop.feature_versions (id, feature_product_id)
        ON DELETE RESTRICT,
    CONSTRAINT feature_licenses_order_item_fkey
        FOREIGN KEY (order_item_id, feature_product_id, acquired_version_id)
        REFERENCES billing.store_order_items (
            id,
            feature_product_id,
            feature_version_id
        ) ON DELETE RESTRICT,
    CONSTRAINT feature_licenses_installation_limit_chk
        CHECK (installation_limit > 0),
    CONSTRAINT feature_licenses_source_chk CHECK (
        (source = 'PURCHASE' AND order_item_id IS NOT NULL AND granted_by IS NULL)
        OR (source = 'GRANT' AND order_item_id IS NULL AND granted_by IS NOT NULL)
    ),
    CONSTRAINT feature_licenses_period_chk CHECK (
        expires_at IS NULL OR expires_at > acquired_at
    ),
    CONSTRAINT feature_licenses_status_timestamp_chk CHECK (
        (status <> 'SUSPENDED' OR suspended_at IS NOT NULL)
        AND (status <> 'REVOKED' OR revoked_at IS NOT NULL)
    )
);

CREATE INDEX feature_licenses_owner_status_idx
    ON private.feature_licenses (owner_user_id, status, acquired_at DESC);

CREATE INDEX feature_licenses_expiry_idx
    ON private.feature_licenses (expires_at)
    WHERE status = 'ACTIVE' AND expires_at IS NOT NULL;

-- Historical assignments are retained. removed_at NULL means the assignment
-- still occupies a bot and counts against the license installation limit.
CREATE TABLE private.bot_feature_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    bot_id UUID NOT NULL,
    feature_product_id UUID NOT NULL,
    feature_version_id UUID NOT NULL,
    status private.feature_installation_status NOT NULL DEFAULT 'INSTALLING',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    removed_at TIMESTAMPTZ,
    last_error_code VARCHAR(80),
    last_error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT bot_feature_installations_license_owner_fkey
        FOREIGN KEY (license_id, owner_user_id)
        REFERENCES private.feature_licenses (id, owner_user_id)
        ON DELETE RESTRICT,
    CONSTRAINT bot_feature_installations_license_product_fkey
        FOREIGN KEY (license_id, feature_product_id)
        REFERENCES private.feature_licenses (id, feature_product_id)
        ON DELETE RESTRICT,
    CONSTRAINT bot_feature_installations_bot_owner_fkey
        FOREIGN KEY (bot_id, owner_user_id)
        REFERENCES bots.bot_instances (id, owner_user_id)
        ON DELETE RESTRICT,
    CONSTRAINT bot_feature_installations_version_product_fkey
        FOREIGN KEY (feature_version_id, feature_product_id)
        REFERENCES shop.feature_versions (id, feature_product_id)
        ON DELETE RESTRICT,
    CONSTRAINT bot_feature_installations_removed_chk CHECK (
        (status = 'REMOVED' AND removed_at IS NOT NULL)
        OR (status <> 'REMOVED' AND removed_at IS NULL)
    )
);

CREATE UNIQUE INDEX bot_feature_installations_active_feature_key
    ON private.bot_feature_installations (bot_id, feature_product_id)
    WHERE removed_at IS NULL;

CREATE INDEX bot_feature_installations_license_history_idx
    ON private.bot_feature_installations (license_id, installed_at DESC);

CREATE INDEX bot_feature_installations_bot_status_idx
    ON private.bot_feature_installations (bot_id, status)
    WHERE removed_at IS NULL;

-- A configuration set survives detach/reattach because it belongs to a license,
-- not a bot. Bot-specific IDs must be revalidated by the backend after a move.
CREATE TABLE private.feature_config_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID NOT NULL UNIQUE,
    feature_product_id UUID NOT NULL,
    feature_version_id UUID NOT NULL,
    revision BIGINT NOT NULL DEFAULT 0,
    validated_for_bot_id UUID,
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_config_sets_id_version_key
        UNIQUE (id, feature_version_id),
    CONSTRAINT feature_config_sets_license_product_fkey
        FOREIGN KEY (license_id, feature_product_id)
        REFERENCES private.feature_licenses (id, feature_product_id)
        ON DELETE CASCADE,
    CONSTRAINT feature_config_sets_version_product_fkey
        FOREIGN KEY (feature_version_id, feature_product_id)
        REFERENCES shop.feature_versions (id, feature_product_id)
        ON DELETE RESTRICT,
    CONSTRAINT feature_config_sets_validated_bot_fkey
        FOREIGN KEY (validated_for_bot_id)
        REFERENCES bots.bot_instances (id) ON DELETE SET NULL,
    CONSTRAINT feature_config_sets_validation_pair_chk CHECK (
        (validated_for_bot_id IS NULL) = (validated_at IS NULL)
    ),
    CONSTRAINT feature_config_sets_revision_chk CHECK (revision >= 0)
);

CREATE TABLE private.feature_config_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_set_id UUID NOT NULL,
    feature_version_id UUID NOT NULL,
    definition_id UUID NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_config_values_set_definition_key
        UNIQUE (config_set_id, definition_id),
    CONSTRAINT feature_config_values_set_version_fkey
        FOREIGN KEY (config_set_id, feature_version_id)
        REFERENCES private.feature_config_sets (id, feature_version_id)
        ON DELETE CASCADE,
    CONSTRAINT feature_config_values_definition_version_fkey
        FOREIGN KEY (definition_id, feature_version_id)
        REFERENCES shop.feature_config_definitions (id, feature_version_id)
        ON DELETE RESTRICT
);

-- Ciphertext, nonce, and fingerprints are produced by the trusted backend.
-- Plaintext secrets never enter a normal config table or a read response.
CREATE TABLE private.feature_secret_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_set_id UUID NOT NULL,
    feature_version_id UUID NOT NULL,
    definition_id UUID NOT NULL,
    ciphertext BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    encryption_algorithm VARCHAR(40) NOT NULL DEFAULT 'AES-256-GCM',
    encryption_key_version VARCHAR(80) NOT NULL,
    fingerprint BYTEA NOT NULL,
    configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_secret_values_set_definition_key
        UNIQUE (config_set_id, definition_id),
    CONSTRAINT feature_secret_values_set_version_fkey
        FOREIGN KEY (config_set_id, feature_version_id)
        REFERENCES private.feature_config_sets (id, feature_version_id)
        ON DELETE CASCADE,
    CONSTRAINT feature_secret_values_definition_version_fkey
        FOREIGN KEY (definition_id, feature_version_id)
        REFERENCES shop.feature_config_definitions (id, feature_version_id)
        ON DELETE RESTRICT,
    CONSTRAINT feature_secret_values_ciphertext_chk CHECK (
        octet_length(ciphertext) > 0
        AND octet_length(nonce) > 0
        AND octet_length(fingerprint) > 0
    )
);

CREATE TABLE private.feature_presentation_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_set_id UUID NOT NULL,
    feature_version_id UUID NOT NULL,
    presentation_slot_id UUID NOT NULL,
    definition JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT feature_presentation_overrides_set_slot_key
        UNIQUE (config_set_id, presentation_slot_id),
    CONSTRAINT feature_presentation_overrides_set_version_fkey
        FOREIGN KEY (config_set_id, feature_version_id)
        REFERENCES private.feature_config_sets (id, feature_version_id)
        ON DELETE CASCADE,
    CONSTRAINT feature_presentation_overrides_slot_version_fkey
        FOREIGN KEY (presentation_slot_id, feature_version_id)
        REFERENCES shop.feature_presentation_slots (id, feature_version_id)
        ON DELETE RESTRICT,
    CONSTRAINT feature_presentation_overrides_definition_chk CHECK (
        jsonb_typeof(definition) = 'object'
    )
);

-- Generic encrypted bot credentials keep Discord tokens and OAuth client
-- secrets out of the bot registry and make future credential kinds additive.
CREATE TABLE private.bot_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL,
    owner_user_id UUID NOT NULL,
    credential_key VARCHAR(80) NOT NULL,
    ciphertext BYTEA NOT NULL,
    nonce BYTEA NOT NULL,
    encryption_algorithm VARCHAR(40) NOT NULL DEFAULT 'AES-256-GCM',
    encryption_key_version VARCHAR(80) NOT NULL,
    fingerprint BYTEA NOT NULL,
    configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT bot_credentials_bot_key
        UNIQUE (bot_id, credential_key),
    CONSTRAINT bot_credentials_bot_owner_fkey
        FOREIGN KEY (bot_id, owner_user_id)
        REFERENCES bots.bot_instances (id, owner_user_id)
        ON DELETE CASCADE,
    CONSTRAINT bot_credentials_key_format_chk CHECK (
        credential_key ~ '^[A-Z][A-Z0-9_]{1,79}$'
    ),
    CONSTRAINT bot_credentials_ciphertext_chk CHECK (
        octet_length(ciphertext) > 0
        AND octet_length(nonce) > 0
        AND octet_length(fingerprint) > 0
    )
);

-- Database-managed timestamps.
CREATE FUNCTION shop.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE FUNCTION bots.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE FUNCTION private.set_store_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER bot_instances_set_updated_at
    BEFORE UPDATE ON bots.bot_instances
    FOR EACH ROW EXECUTE FUNCTION bots.set_updated_at();

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'feature_products',
        'feature_versions',
        'feature_offers',
        'feature_config_definitions',
        'feature_presentation_slots'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at
             BEFORE UPDATE ON shop.%I
             FOR EACH ROW EXECUTE FUNCTION shop.set_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END;
$$;

CREATE TRIGGER store_orders_set_updated_at
    BEFORE UPDATE ON billing.store_orders
    FOR EACH ROW EXECUTE FUNCTION billing.set_updated_at();

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'feature_licenses',
        'bot_feature_installations',
        'feature_config_sets',
        'feature_config_values',
        'feature_secret_values',
        'feature_presentation_overrides',
        'bot_credentials'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at
             BEFORE UPDATE ON private.%I
             FOR EACH ROW EXECUTE FUNCTION private.set_store_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END;
$$;

-- Validate immutable order identity, legal state transitions, exact line totals,
-- and the append-only wallet entries that settle purchases and refunds.
CREATE FUNCTION billing.validate_store_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    item_count INTEGER;
    item_total BIGINT;
    matching_entry_count INTEGER;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.id IS DISTINCT FROM OLD.id
           OR NEW.order_number IS DISTINCT FROM OLD.order_number
           OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
           OR NEW.total_satang IS DISTINCT FROM OLD.total_satang
           OR NEW.currency IS DISTINCT FROM OLD.currency
           OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'store order identity and totals are immutable';
        END IF;

        IF NEW.status IS DISTINCT FROM OLD.status
           AND NOT (
                (OLD.status = 'PENDING' AND NEW.status IN ('PAID', 'CANCELLED', 'FAILED'))
                OR (OLD.status = 'PAID' AND NEW.status = 'REFUNDED')
           ) THEN
            RAISE EXCEPTION 'invalid store order status transition';
        END IF;

        IF OLD.status IN ('PAID', 'REFUNDED')
           AND (
                NEW.wallet_entry_id IS DISTINCT FROM OLD.wallet_entry_id
                OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
           ) THEN
            RAISE EXCEPTION 'store order purchase settlement is immutable';
        END IF;

        IF OLD.status = 'REFUNDED'
           AND (
                NEW.refund_wallet_entry_id
                    IS DISTINCT FROM OLD.refund_wallet_entry_id
                OR NEW.refunded_at IS DISTINCT FROM OLD.refunded_at
           ) THEN
            RAISE EXCEPTION 'store order refund settlement is immutable';
        END IF;
    END IF;

    IF NEW.status IN ('PAID', 'REFUNDED') THEN
        SELECT count(*), COALESCE(sum(item.line_total_satang), 0)
          INTO item_count, item_total
          FROM billing.store_order_items AS item
         WHERE item.order_id = NEW.id;

        IF item_count = 0 OR item_total <> NEW.total_satang THEN
            RAISE EXCEPTION 'store order total does not match its items';
        END IF;

        SELECT count(*)
          INTO matching_entry_count
          FROM billing.wallet_entries AS entry
          JOIN billing.wallets AS wallet
            ON wallet.id = entry.wallet_id
         WHERE entry.id = NEW.wallet_entry_id
           AND wallet.customer_id = NEW.customer_id
           AND entry.direction = 'DEBIT'
           AND entry.entry_type = 'PURCHASE'
           AND entry.amount_satang = NEW.total_satang
           AND entry.reference_type = 'STORE_ORDER'
           AND entry.reference_id = NEW.id;

        IF matching_entry_count <> 1 THEN
            RAISE EXCEPTION 'store order has no matching purchase wallet entry';
        END IF;
    END IF;

    IF NEW.status = 'REFUNDED' THEN
        SELECT count(*)
          INTO matching_entry_count
          FROM billing.wallet_entries AS entry
          JOIN billing.wallets AS wallet
            ON wallet.id = entry.wallet_id
         WHERE entry.id = NEW.refund_wallet_entry_id
           AND wallet.customer_id = NEW.customer_id
           AND entry.direction = 'CREDIT'
           AND entry.entry_type = 'REFUND'
           AND entry.amount_satang = NEW.total_satang
           AND entry.reference_type = 'STORE_ORDER_REFUND'
           AND entry.reference_id = NEW.id;

        IF matching_entry_count <> 1 THEN
            RAISE EXCEPTION 'store order has no matching refund wallet entry';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER store_orders_validate
    BEFORE INSERT OR UPDATE ON billing.store_orders
    FOR EACH ROW EXECUTE FUNCTION billing.validate_store_order();

-- Prevent accidental edits to receipt lines once checkout has left PENDING.
CREATE FUNCTION billing.protect_store_order_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    parent_status billing.store_order_status;
BEGIN
    SELECT store_order.status
      INTO parent_status
      FROM billing.store_orders AS store_order
     WHERE store_order.id = OLD.order_id;

    IF parent_status IS DISTINCT FROM 'PENDING' THEN
        RAISE EXCEPTION 'store order items are immutable after checkout';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER store_order_items_protect
    BEFORE UPDATE OR DELETE ON billing.store_order_items
    FOR EACH ROW EXECUTE FUNCTION billing.protect_store_order_item();

-- A purchased license can only be minted from a paid line item. Locking the
-- line serializes concurrent grants and prevents quantity over-issuance.
CREATE FUNCTION private.validate_feature_license_acquisition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    order_item billing.store_order_items;
    order_status billing.store_order_status;
    order_owner_user_id UUID;
    issued_count INTEGER;
BEGIN
    IF NEW.source = 'GRANT' THEN
        RETURN NEW;
    END IF;

    SELECT item.*
      INTO order_item
      FROM billing.store_order_items AS item
     WHERE item.id = NEW.order_item_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'store order item does not exist';
    END IF;

    SELECT store_order.status, customer.user_id
      INTO order_status, order_owner_user_id
      FROM billing.store_orders AS store_order
      JOIN billing.customers AS customer
        ON customer.id = store_order.customer_id
     WHERE store_order.id = order_item.order_id;

    IF order_status <> 'PAID' THEN
        RAISE EXCEPTION 'feature licenses require a paid store order';
    END IF;

    IF order_owner_user_id IS NULL
       OR NEW.owner_user_id <> order_owner_user_id THEN
        RAISE EXCEPTION 'feature license owner differs from store order owner';
    END IF;

    IF NEW.installation_limit <> order_item.installation_limit_snapshot THEN
        RAISE EXCEPTION 'feature license installation limit differs from purchase';
    END IF;

    IF order_item.offer_kind_snapshot = 'SUBSCRIPTION' THEN
        IF NEW.expires_at IS NULL
           OR NEW.expires_at <> NEW.acquired_at
                + make_interval(days => order_item.billing_period_days_snapshot) THEN
            RAISE EXCEPTION 'subscription license expiry differs from purchase';
        END IF;
    ELSIF NEW.expires_at IS NOT NULL THEN
        RAISE EXCEPTION 'one-time feature licenses do not expire';
    END IF;

    SELECT count(*)
      INTO issued_count
      FROM private.feature_licenses AS feature_license
     WHERE feature_license.order_item_id = NEW.order_item_id
       AND feature_license.id IS DISTINCT FROM NEW.id;

    IF issued_count >= order_item.quantity THEN
        RAISE EXCEPTION 'store order item license quantity exceeded';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER feature_licenses_validate_acquisition
    BEFORE INSERT OR UPDATE OF
        order_item_id,
        source,
        installation_limit,
        acquired_at,
        expires_at
    ON private.feature_licenses
    FOR EACH ROW EXECUTE FUNCTION private.validate_feature_license_acquisition();

-- Lock the license before counting active assignments so concurrent installs
-- cannot exceed the purchased installation limit.
CREATE FUNCTION private.validate_feature_installation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    license private.feature_licenses;
    active_installations INTEGER;
    installed_version_status shop.feature_version_status;
BEGIN
    IF NEW.removed_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT feature_license.*
      INTO license
      FROM private.feature_licenses AS feature_license
     WHERE feature_license.id = NEW.license_id
     FOR UPDATE;

    IF license.status <> 'ACTIVE'
       OR (license.expires_at IS NOT NULL AND license.expires_at <= now()) THEN
        RAISE EXCEPTION 'feature license is not active';
    END IF;

    SELECT feature_version.status
      INTO installed_version_status
      FROM shop.feature_versions AS feature_version
     WHERE feature_version.id = NEW.feature_version_id;

    IF installed_version_status = 'DRAFT' THEN
        RAISE EXCEPTION 'draft feature versions cannot be installed';
    END IF;

    SELECT count(*)
      INTO active_installations
      FROM private.bot_feature_installations AS installation
     WHERE installation.license_id = NEW.license_id
       AND installation.removed_at IS NULL
       AND installation.id IS DISTINCT FROM NEW.id;

    IF active_installations >= license.installation_limit THEN
        RAISE EXCEPTION 'feature license installation limit exceeded';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER bot_feature_installations_validate
    BEFORE INSERT OR UPDATE ON private.bot_feature_installations
    FOR EACH ROW EXECUTE FUNCTION private.validate_feature_installation();

-- The table boundary, rather than an application boolean, decides whether a
-- value is a secret. This prevents secret definitions entering normal JSON.
CREATE FUNCTION private.validate_feature_config_storage()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    definition_is_secret BOOLEAN;
BEGIN
    SELECT definition.is_secret
      INTO definition_is_secret
      FROM shop.feature_config_definitions AS definition
     WHERE definition.id = NEW.definition_id;

    IF definition_is_secret IS NULL THEN
        RAISE EXCEPTION 'feature config definition does not exist';
    END IF;

    IF TG_TABLE_NAME = 'feature_config_values' AND definition_is_secret THEN
        RAISE EXCEPTION 'secret config cannot be stored as a normal value';
    END IF;

    IF TG_TABLE_NAME = 'feature_secret_values' AND NOT definition_is_secret THEN
        RAISE EXCEPTION 'normal config cannot be stored as a secret value';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER feature_config_values_validate_storage
    BEFORE INSERT OR UPDATE ON private.feature_config_values
    FOR EACH ROW EXECUTE FUNCTION private.validate_feature_config_storage();

CREATE TRIGGER feature_secret_values_validate_storage
    BEFORE INSERT OR UPDATE ON private.feature_secret_values
    FOR EACH ROW EXECUTE FUNCTION private.validate_feature_config_storage();

REVOKE ALL ON FUNCTION shop.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION bots.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.set_store_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.validate_store_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION billing.protect_store_order_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validate_feature_license_acquisition() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validate_feature_installation() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.validate_feature_config_storage() FROM PUBLIC;

-- These schemas are not exposed through the Supabase Data API. The backend is
-- the sole access path; RLS is enabled as defense in depth on every table.
GRANT USAGE ON SCHEMA shop, bots TO service_role;

DO $$
DECLARE
    table_ref TEXT;
    schema_name TEXT;
    table_name TEXT;
BEGIN
    FOREACH table_ref IN ARRAY ARRAY[
        'bots.bot_instances',
        'shop.feature_products',
        'shop.feature_versions',
        'shop.feature_offers',
        'shop.feature_config_definitions',
        'shop.feature_presentation_slots',
        'billing.store_orders',
        'billing.store_order_items',
        'private.feature_licenses',
        'private.bot_feature_installations',
        'private.feature_config_sets',
        'private.feature_config_values',
        'private.feature_secret_values',
        'private.feature_presentation_overrides',
        'private.bot_credentials'
    ]
    LOOP
        schema_name := split_part(table_ref, '.', 1);
        table_name := split_part(table_ref, '.', 2);

        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            schema_name,
            table_name
        );
        EXECUTE format(
            'REVOKE ALL ON TABLE %I.%I FROM anon, authenticated',
            schema_name,
            table_name
        );
        EXECUTE format(
            'GRANT ALL ON TABLE %I.%I TO service_role',
            schema_name,
            table_name
        );
    END LOOP;
END;
$$;

COMMENT ON TABLE private.feature_licenses IS
    'Independently assignable feature copies owned by users.';
COMMENT ON TABLE private.bot_feature_installations IS
    'Historical bot assignments; a removed assignment does not remove ownership.';
COMMENT ON TABLE private.feature_config_sets IS
    'License-owned configuration retained while a feature is unassigned.';
COMMENT ON TABLE private.feature_secret_values IS
    'Backend-encrypted feature secrets; plaintext must never be persisted.';
