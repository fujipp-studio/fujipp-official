-- Catalog-only checks: no application/customer rows are read or modified.
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname='fujipp_backend' AND (rolsuper OR rolcreatedb OR rolcreaterole))
       OR NOT EXISTS (SELECT FROM pg_roles WHERE rolname='fujipp_backend') THEN
        RAISE EXCEPTION 'Backend role is missing or has administrative privileges';
    END IF;
    IF EXISTS (SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
               WHERE n.nspname IN ('public','portfolio','bots','shop','support','billing')
                 AND c.relkind IN ('r','p') AND NOT c.relrowsecurity) THEN
        RAISE EXCEPTION 'An application table in an exposed schema has no RLS';
    END IF;
END $$;
