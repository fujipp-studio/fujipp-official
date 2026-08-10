
CREATE SCHEMA portfolio;

CREATE TYPE portfolio.project_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'ACTIVE',
    'COMPLETED',
    'ARCHIVED'
);

CREATE TYPE portfolio.publication_status AS ENUM (
    'DRAFT',
    'PUBLISHED'
);

CREATE TYPE portfolio.project_media_type AS ENUM (
    'GALLERY',
    'ARCHITECTURE'
);

CREATE TYPE portfolio.project_content_type AS ENUM (
    'FEATURE',
    'CHALLENGE',
    'LEARNING'
);

CREATE TYPE portfolio.project_link_type AS ENUM (
    'FIGMA',
    'GITHUB',
    'WEBSITE',
    'YOUTUBE',
    'CERTIFICATE',
    'LIVE',
    'OTHER'
);

CREATE TABLE portfolio.project_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_categories_code_format_chk
        CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT project_categories_name_chk
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT project_categories_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE TABLE portfolio.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT positions_code_format_chk
        CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT positions_name_chk
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT positions_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE TABLE portfolio.technology_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT technology_groups_code_format_chk
        CHECK (code ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT technology_groups_name_chk
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT technology_groups_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE TABLE portfolio.technologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL
        REFERENCES portfolio.technology_groups (id) ON DELETE RESTRICT,
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    icon_url TEXT,
    official_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT technologies_slug_format_chk
        CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT technologies_name_chk
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT technologies_icon_url_chk
        CHECK (icon_url IS NULL OR icon_url ~ '^https://'),
    CONSTRAINT technologies_official_url_chk
        CHECK (official_url IS NULL OR official_url ~ '^https://')
);

CREATE INDEX technologies_group_id_idx
    ON portfolio.technologies (group_id);

CREATE TABLE portfolio.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) NOT NULL UNIQUE,
    category_id UUID NOT NULL
        REFERENCES portfolio.project_categories (id) ON DELETE RESTRICT,
    status portfolio.project_status NOT NULL DEFAULT 'PLANNED',
    publication_status portfolio.publication_status NOT NULL DEFAULT 'DRAFT',
    started_on DATE,
    completed_on DATE,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    featured_order INTEGER,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    updated_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT projects_slug_format_chk
        CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT projects_date_range_chk
        CHECK (
            completed_on IS NULL
            OR started_on IS NULL
            OR completed_on >= started_on
        ),
    CONSTRAINT projects_completed_date_chk
        CHECK (status <> 'COMPLETED' OR completed_on IS NOT NULL),
    CONSTRAINT projects_featured_order_chk
        CHECK (
            (is_featured = false AND featured_order IS NULL)
            OR (is_featured = true AND featured_order IS NOT NULL AND featured_order >= 0)
        ),
    CONSTRAINT projects_publication_date_chk
        CHECK (
            (publication_status = 'DRAFT' AND published_at IS NULL)
            OR (publication_status = 'PUBLISHED' AND published_at IS NOT NULL)
        )
);

CREATE INDEX projects_category_id_idx
    ON portfolio.projects (category_id);
CREATE INDEX projects_status_idx
    ON portfolio.projects (status);
CREATE INDEX projects_publication_idx
    ON portfolio.projects (publication_status, published_at DESC);
CREATE UNIQUE INDEX projects_featured_order_key
    ON portfolio.projects (featured_order)
    WHERE is_featured = true;

CREATE TABLE portfolio.project_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES portfolio.projects (id) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL,
    name VARCHAR(100) NOT NULL,
    short_description VARCHAR(120) NOT NULL,
    overview TEXT NOT NULL,
    feasibility TEXT NOT NULL,
    target_users TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_translations_project_locale_key
        UNIQUE (project_id, locale),
    CONSTRAINT project_translations_locale_chk
        CHECK (locale IN ('th', 'en')),
    CONSTRAINT project_translations_name_chk
        CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
    CONSTRAINT project_translations_short_description_chk
        CHECK (char_length(btrim(short_description)) BETWEEN 1 AND 120),
    CONSTRAINT project_translations_overview_chk
        CHECK (char_length(btrim(overview)) BETWEEN 1 AND 2000),
    CONSTRAINT project_translations_feasibility_chk
        CHECK (char_length(btrim(feasibility)) BETWEEN 1 AND 2000),
    CONSTRAINT project_translations_target_users_chk
        CHECK (char_length(btrim(target_users)) BETWEEN 1 AND 2000)
);

CREATE INDEX project_translations_project_id_idx
    ON portfolio.project_translations (project_id);

CREATE TABLE portfolio.project_positions (
    project_id UUID NOT NULL
        REFERENCES portfolio.projects (id) ON DELETE CASCADE,
    position_id UUID NOT NULL
        REFERENCES portfolio.positions (id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_positions_pkey
        PRIMARY KEY (project_id, position_id),
    CONSTRAINT project_positions_project_sort_key
        UNIQUE (project_id, sort_order),
    CONSTRAINT project_positions_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE INDEX project_positions_position_id_idx
    ON portfolio.project_positions (position_id);

CREATE TABLE portfolio.project_technologies (
    project_id UUID NOT NULL
        REFERENCES portfolio.projects (id) ON DELETE CASCADE,
    technology_id UUID NOT NULL
        REFERENCES portfolio.technologies (id) ON DELETE RESTRICT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_technologies_pkey
        PRIMARY KEY (project_id, technology_id),
    CONSTRAINT project_technologies_project_sort_key
        UNIQUE (project_id, sort_order),
    CONSTRAINT project_technologies_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE INDEX project_technologies_technology_id_idx
    ON portfolio.project_technologies (technology_id);

CREATE TABLE portfolio.project_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES portfolio.projects (id) ON DELETE CASCADE,
    media_type portfolio.project_media_type NOT NULL,
    cloudinary_public_id VARCHAR(255) NOT NULL,
    secure_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    format VARCHAR(20),
    bytes BIGINT,
    alt_text VARCHAR(255),
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_media_cloudinary_public_id_key
        UNIQUE (cloudinary_public_id),
    CONSTRAINT project_media_secure_url_chk
        CHECK (secure_url ~ '^https://'),
    CONSTRAINT project_media_dimensions_chk
        CHECK (
            (width IS NULL OR width > 0)
            AND (height IS NULL OR height > 0)
        ),
    CONSTRAINT project_media_bytes_chk
        CHECK (bytes IS NULL OR bytes >= 0),
    CONSTRAINT project_media_sort_order_chk
        CHECK (
            (media_type = 'GALLERY' AND sort_order BETWEEN 1 AND 5)
            OR (media_type = 'ARCHITECTURE' AND sort_order = 1)
        )
);

CREATE INDEX project_media_project_id_idx
    ON portfolio.project_media (project_id);
CREATE UNIQUE INDEX project_media_gallery_order_key
    ON portfolio.project_media (project_id, sort_order)
    WHERE media_type = 'GALLERY';
CREATE UNIQUE INDEX project_media_architecture_key
    ON portfolio.project_media (project_id)
    WHERE media_type = 'ARCHITECTURE';

CREATE TABLE portfolio.project_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES portfolio.projects (id) ON DELETE CASCADE,
    link_type portfolio.project_link_type NOT NULL,
    label VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_links_label_chk
        CHECK (char_length(btrim(label)) BETWEEN 1 AND 100),
    CONSTRAINT project_links_url_chk
        CHECK (url ~ '^https://'),
    CONSTRAINT project_links_project_sort_key
        UNIQUE (project_id, sort_order),
    CONSTRAINT project_links_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE INDEX project_links_project_id_idx
    ON portfolio.project_links (project_id);

CREATE TABLE portfolio.project_content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES portfolio.projects (id) ON DELETE CASCADE,
    content_type portfolio.project_content_type NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_content_items_project_type_sort_key
        UNIQUE (project_id, content_type, sort_order),
    CONSTRAINT project_content_items_sort_order_chk
        CHECK (sort_order >= 0)
);

CREATE INDEX project_content_items_project_id_idx
    ON portfolio.project_content_items (project_id);

CREATE TABLE portfolio.project_content_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL
        REFERENCES portfolio.project_content_items (id) ON DELETE CASCADE,
    locale VARCHAR(5) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT project_content_translations_item_locale_key
        UNIQUE (content_item_id, locale),
    CONSTRAINT project_content_translations_locale_chk
        CHECK (locale IN ('th', 'en')),
    CONSTRAINT project_content_translations_title_chk
        CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    CONSTRAINT project_content_translations_description_chk
        CHECK (char_length(btrim(description)) BETWEEN 1 AND 4000)
);

CREATE INDEX project_content_translations_item_id_idx
    ON portfolio.project_content_translations (content_item_id);

CREATE FUNCTION portfolio.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'project_categories',
        'positions',
        'technology_groups',
        'technologies',
        'projects',
        'project_translations',
        'project_media',
        'project_links',
        'project_content_items',
        'project_content_translations'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at
             BEFORE UPDATE ON portfolio.%I
             FOR EACH ROW EXECUTE FUNCTION portfolio.set_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION portfolio.set_updated_at() FROM PUBLIC;

CREATE FUNCTION portfolio.prepare_project_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    translation_count INTEGER;
BEGIN
    IF NEW.publication_status = 'PUBLISHED' THEN
        SELECT count(DISTINCT translation.locale)
          INTO translation_count
          FROM portfolio.project_translations AS translation
         WHERE translation.project_id = NEW.id
           AND translation.locale IN ('th', 'en');

        IF translation_count <> 2 THEN
            RAISE EXCEPTION
                'a published project requires both th and en translations';
        END IF;

        IF EXISTS (
            SELECT 1
              FROM portfolio.project_content_items AS content_item
             WHERE content_item.project_id = NEW.id
               AND (
                    NOT EXISTS (
                        SELECT 1
                          FROM portfolio.project_content_translations AS translation
                         WHERE translation.content_item_id = content_item.id
                           AND translation.locale = 'th'
                    )
                    OR NOT EXISTS (
                        SELECT 1
                          FROM portfolio.project_content_translations AS translation
                         WHERE translation.content_item_id = content_item.id
                           AND translation.locale = 'en'
                    )
               )
        ) THEN
            RAISE EXCEPTION
                'every published project content item requires th and en translations';
        END IF;

        IF TG_OP = 'INSERT' THEN
            NEW.published_at := now();
        ELSE
            NEW.published_at := COALESCE(OLD.published_at, now());
        END IF;
    ELSE
        NEW.published_at := NULL;
        NEW.is_featured := false;
        NEW.featured_order := NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER projects_prepare_publication
    BEFORE INSERT OR UPDATE ON portfolio.projects
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.prepare_project_publication();

REVOKE ALL ON FUNCTION portfolio.prepare_project_publication() FROM PUBLIC;

CREATE FUNCTION portfolio.protect_published_project_translation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM portfolio.projects AS project
         WHERE project.id = OLD.project_id
           AND project.publication_status = 'PUBLISHED'
    ) THEN
        RAISE EXCEPTION
            'unpublish the project before removing or reassigning a translation';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER project_translations_protect_published_delete
    BEFORE DELETE ON portfolio.project_translations
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_translation();

CREATE TRIGGER project_translations_protect_published_reassignment
    BEFORE UPDATE OF project_id, locale ON portfolio.project_translations
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_translation();

REVOKE ALL ON FUNCTION
    portfolio.protect_published_project_translation()
    FROM PUBLIC;

CREATE FUNCTION portfolio.protect_published_project_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    protected_project_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'project_content_items' THEN
        IF TG_OP = 'INSERT' THEN
            protected_project_id := NEW.project_id;
        ELSE
            protected_project_id := OLD.project_id;
        END IF;
    ELSE
        SELECT content_item.project_id
          INTO protected_project_id
          FROM portfolio.project_content_items AS content_item
         WHERE content_item.id = OLD.content_item_id;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM portfolio.projects AS project
         WHERE project.id = protected_project_id
           AND project.publication_status = 'PUBLISHED'
    ) THEN
        RAISE EXCEPTION
            'unpublish the project before changing its content structure';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER project_content_items_protect_published_insert
    BEFORE INSERT ON portfolio.project_content_items
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_content();

CREATE TRIGGER project_content_items_protect_published_delete
    BEFORE DELETE ON portfolio.project_content_items
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_content();

CREATE TRIGGER project_content_items_protect_published_reassignment
    BEFORE UPDATE OF project_id, content_type
    ON portfolio.project_content_items
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_content();

CREATE TRIGGER project_content_translations_protect_published_delete
    BEFORE DELETE ON portfolio.project_content_translations
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_content();

CREATE TRIGGER project_content_translations_protect_published_reassignment
    BEFORE UPDATE OF content_item_id, locale
    ON portfolio.project_content_translations
    FOR EACH ROW
    EXECUTE FUNCTION portfolio.protect_published_project_content();

REVOKE ALL ON FUNCTION
    portfolio.protect_published_project_content()
    FROM PUBLIC;

INSERT INTO portfolio.project_categories (
    code,
    name,
    sort_order,
    is_system
)
VALUES
    ('client', 'Client Project', 10, true),
    ('senior', 'Senior Project', 20, true),
    ('internship', 'Internship Project', 30, true),
    ('personal', 'Personal Project', 40, true),
    ('open-source', 'Open Source', 50, true),
    ('experimental', 'Experimental', 60, true),
    ('team', 'Team Project', 70, true),
    ('startup', 'Startup', 80, true);

INSERT INTO portfolio.positions (
    code,
    name,
    sort_order,
    is_system
)
VALUES
    ('frontend-engineer', 'Frontend Engineer', 10, true),
    ('backend-engineer', 'Backend Engineer', 20, true),
    ('full-stack-engineer', 'Full Stack Engineer', 30, true),
    ('mobile-developer', 'Mobile Developer', 40, true),
    ('devops-engineer', 'DevOps Engineer', 50, true),
    ('site-reliability-engineer', 'Site Reliability Engineer (SRE)', 60, true),
    ('qa-automated-test-engineer', 'QA / Automated Test Engineer', 70, true),
    ('cloud-engineer', 'Cloud Engineer', 80, true),
    ('security-engineer-devsecops', 'Security Engineer / DevSecOps', 90, true),
    ('system-analyst', 'System Analyst (SA)', 100, true),
    ('database-administrator', 'Database Administrator (DBA)', 110, true),
    ('data-engineer', 'Data Engineer', 120, true),
    ('data-scientist', 'Data Scientist', 130, true),
    ('data-analyst', 'Data Analyst', 140, true),
    ('ai-machine-learning-engineer', 'AI / Machine Learning Engineer', 150, true),
    ('blockchain-developer', 'Blockchain Developer', 160, true),
    ('game-developer', 'Game Developer', 170, true),
    ('embedded-systems-engineer', 'Embedded Systems Engineer', 180, true),
    ('ux-ui-designer', 'UX/UI Designer', 190, true),
    ('ux-designer', 'UX Designer', 200, true),
    ('ui-designer', 'UI Designer', 210, true),
    ('ux-researcher', 'UX Researcher', 220, true),
    ('ux-writer', 'UX Writer', 230, true),
    ('product-designer', 'Product Designer', 240, true),
    ('interaction-designer', 'Interaction Designer', 250, true),
    ('visual-designer', 'Visual Designer', 260, true),
    ('motion-designer', 'Motion Designer', 270, true),
    ('product-manager', 'Product Manager (PM)', 280, true),
    ('project-manager', 'Project Manager', 290, true),
    ('scrum-master', 'Scrum Master', 300, true),
    ('business-analyst', 'Business Analyst (BA)', 310, true),
    ('tech-lead', 'Tech Lead', 320, true),
    ('software-architect', 'Software Architect', 330, true),
    ('engineering-manager', 'Engineering Manager', 340, true);

INSERT INTO portfolio.technology_groups (code, name, sort_order)
VALUES
    ('frontend', 'Frontend', 10),
    ('backend', 'Backend', 20),
    ('mobile', 'Mobile', 30),
    ('database', 'Database', 40),
    ('devops', 'DevOps', 50),
    ('cloud', 'Cloud', 60),
    ('testing', 'Testing', 70),
    ('design', 'Design', 80),
    ('data-ai', 'Data & AI', 90),
    ('other', 'Other', 100);

GRANT USAGE ON SCHEMA portfolio TO anon, authenticated, service_role;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'project_categories',
        'positions',
        'technology_groups',
        'technologies',
        'projects',
        'project_translations',
        'project_positions',
        'project_technologies',
        'project_media',
        'project_links',
        'project_content_items',
        'project_content_translations'
    ]
    LOOP
        EXECUTE format(
            'ALTER TABLE portfolio.%I ENABLE ROW LEVEL SECURITY',
            table_name
        );
        EXECUTE format(
            'REVOKE ALL ON TABLE portfolio.%I FROM anon, authenticated',
            table_name
        );
        EXECUTE format(
            'GRANT SELECT ON TABLE portfolio.%I TO anon, authenticated',
            table_name
        );
        EXECUTE format(
            'GRANT ALL ON TABLE portfolio.%I TO service_role',
            table_name
        );
    END LOOP;
END;
$$;

CREATE POLICY project_categories_read
    ON portfolio.project_categories
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY positions_read
    ON portfolio.positions
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY technology_groups_read
    ON portfolio.technology_groups
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY technologies_read
    ON portfolio.technologies
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY projects_read_published
    ON portfolio.projects
    FOR SELECT
    TO anon, authenticated
    USING (publication_status = 'PUBLISHED');

CREATE POLICY project_translations_read_published
    ON portfolio.project_translations
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.projects AS project
             WHERE project.id = project_translations.project_id
               AND project.publication_status = 'PUBLISHED'
        )
    );

CREATE POLICY project_positions_read_published
    ON portfolio.project_positions
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.projects AS project
             WHERE project.id = project_positions.project_id
               AND project.publication_status = 'PUBLISHED'
        )
    );

CREATE POLICY project_technologies_read_published
    ON portfolio.project_technologies
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.projects AS project
             WHERE project.id = project_technologies.project_id
               AND project.publication_status = 'PUBLISHED'
        )
    );

CREATE POLICY project_media_read_published
    ON portfolio.project_media
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.projects AS project
             WHERE project.id = project_media.project_id
               AND project.publication_status = 'PUBLISHED'
        )
    );

CREATE POLICY project_links_read_published
    ON portfolio.project_links
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.projects AS project
             WHERE project.id = project_links.project_id
               AND project.publication_status = 'PUBLISHED'
        )
    );

CREATE POLICY project_content_items_read_published
    ON portfolio.project_content_items
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.projects AS project
             WHERE project.id = project_content_items.project_id
               AND project.publication_status = 'PUBLISHED'
        )
    );

CREATE POLICY project_content_translations_read_published
    ON portfolio.project_content_translations
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM portfolio.project_content_items AS content_item
              JOIN portfolio.projects AS project
                ON project.id = content_item.project_id
             WHERE content_item.id =
                   project_content_translations.content_item_id
               AND project.publication_status = 'PUBLISHED'
        )
    );
