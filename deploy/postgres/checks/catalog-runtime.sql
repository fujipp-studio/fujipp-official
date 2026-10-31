DO $$ DECLARE target text; BEGIN
    FOREACH target IN ARRAY ARRAY['shop.feature_products','shop.feature_versions','bots.bot_instances'] LOOP
        IF to_regclass(target) IS NULL THEN
            RAISE EXCEPTION 'Missing catalog-runtime database object';
        END IF;
    END LOOP;
END $$;
