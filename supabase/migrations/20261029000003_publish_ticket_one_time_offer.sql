-- Publish Ticket with the approved THB 100 one-time, single-installation offer.
DO $$
DECLARE
    ticket_product_id UUID;
    ticket_version_id UUID;
BEGIN
    SELECT id INTO STRICT ticket_product_id
      FROM shop.feature_products
     WHERE code = 'ticket'
     FOR UPDATE;

    SELECT id INTO STRICT ticket_version_id
      FROM shop.feature_versions
     WHERE feature_product_id = ticket_product_id AND version = '1.0.0';

    UPDATE shop.feature_versions
       SET status = 'DEPRECATED'
     WHERE feature_product_id = ticket_product_id
       AND status = 'PUBLISHED' AND id <> ticket_version_id;

    UPDATE shop.feature_versions
       SET status = 'PUBLISHED', published_at = COALESCE(published_at, now())
     WHERE id = ticket_version_id;

    INSERT INTO shop.feature_offers (
        feature_product_id, code, name, offer_kind, price_satang, currency,
        billing_period_days, installation_limit, is_active
    ) VALUES (
        ticket_product_id, 'ticket-lifetime', 'Ticket ซื้อขาด', 'ONE_TIME', 10000, 'THB',
        NULL, 1, true
    )
    ON CONFLICT (feature_product_id, code) DO UPDATE
    SET name = EXCLUDED.name,
        offer_kind = EXCLUDED.offer_kind,
        price_satang = EXCLUDED.price_satang,
        currency = EXCLUDED.currency,
        billing_period_days = EXCLUDED.billing_period_days,
        installation_limit = EXCLUDED.installation_limit,
        is_active = EXCLUDED.is_active,
        starts_at = NULL,
        ends_at = NULL;

    UPDATE shop.feature_products
       SET status = 'ACTIVE'
     WHERE id = ticket_product_id;
END;
$$;
