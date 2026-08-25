package com.fujipp.backend.work.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AdminWorkRepository {

    private final JdbcTemplate jdbcTemplate;

    public AdminWorkRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<AdminWorkResponse> findAll() {
        return jdbcTemplate.query(
                        """
                        SELECT id
                          FROM portfolio.projects
                         ORDER BY updated_at DESC, slug
                        """,
                        (resultSet, rowNumber) -> resultSet.getObject("id", UUID.class)
                ).stream()
                .map(this::findById)
                .flatMap(Optional::stream)
                .toList();
    }

    public AdminWorkCatalogResponse findCatalog() {
        List<AdminWorkCatalogResponse.Category> categories = jdbcTemplate.query(
                """
                SELECT code, name
                  FROM portfolio.project_categories
                 WHERE is_active = true
                 ORDER BY sort_order, name
                """,
                (resultSet, rowNumber) -> new AdminWorkCatalogResponse.Category(
                        resultSet.getString("code"), resultSet.getString("name")
                )
        );
        List<AdminWorkCatalogResponse.Position> positions = jdbcTemplate.query(
                """
                SELECT code, name
                  FROM portfolio.positions
                 WHERE is_active = true
                 ORDER BY sort_order, name
                """,
                (resultSet, rowNumber) -> new AdminWorkCatalogResponse.Position(
                        resultSet.getString("code"), resultSet.getString("name")
                )
        );
        List<AdminWorkCatalogResponse.TechnologyGroup> technologyGroups = jdbcTemplate.query(
                """
                SELECT code, name
                  FROM portfolio.technology_groups
                 WHERE is_active = true
                 ORDER BY sort_order, name
                """,
                (resultSet, rowNumber) -> new AdminWorkCatalogResponse.TechnologyGroup(
                        resultSet.getString("code"), resultSet.getString("name")
                )
        );
        List<AdminWorkCatalogResponse.Technology> technologies = jdbcTemplate.query(
                """
                SELECT technology.slug,
                       technology.name,
                       technology_group.code AS group_code,
                       technology_group.name AS group_name
                  FROM portfolio.technologies AS technology
                  JOIN portfolio.technology_groups AS technology_group
                    ON technology_group.id = technology.group_id
                 WHERE technology.is_active = true
                   AND technology_group.is_active = true
                 ORDER BY technology_group.sort_order, technology_group.name, technology.name
                """,
                (resultSet, rowNumber) -> new AdminWorkCatalogResponse.Technology(
                        resultSet.getString("slug"),
                        resultSet.getString("name"),
                        resultSet.getString("group_code"),
                        resultSet.getString("group_name")
                )
        );
        return new AdminWorkCatalogResponse(categories, positions, technologyGroups, technologies);
    }

    public boolean activeTechnologyGroupExists(String code) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM portfolio.technology_groups WHERE code = ? AND is_active = true",
                Integer.class,
                code
        );
        return count != null && count > 0;
    }

    public AdminWorkCatalogResponse.Technology createTechnology(CreateTechnologyRequest request) {
        jdbcTemplate.update(
                """
                INSERT INTO portfolio.technologies (group_id, slug, name, icon_url, official_url)
                SELECT id, ?, ?, ?, ?
                  FROM portfolio.technology_groups
                 WHERE code = ?
                   AND is_active = true
                """,
                request.slug(), request.name(), request.iconUrl(), request.officialUrl(), request.groupCode()
        );
        return jdbcTemplate.queryForObject(
                """
                SELECT technology.slug, technology.name,
                       technology_group.code AS group_code,
                       technology_group.name AS group_name
                  FROM portfolio.technologies AS technology
                  JOIN portfolio.technology_groups AS technology_group ON technology_group.id = technology.group_id
                 WHERE technology.slug = ?
                """,
                (resultSet, rowNumber) -> new AdminWorkCatalogResponse.Technology(
                        resultSet.getString("slug"), resultSet.getString("name"),
                        resultSet.getString("group_code"), resultSet.getString("group_name")
                ),
                request.slug()
        );
    }

    public Optional<AdminWorkResponse> findById(UUID id) {
        List<AdminWorkRow> rows = jdbcTemplate.query(
                """
                SELECT project.id,
                       project.slug,
                       category.code AS category_code,
                       category.name AS category_name,
                       project.status::text,
                       project.publication_status::text,
                       project.started_on,
                       project.completed_on,
                       project.is_featured,
                       project.featured_order,
                       project.published_at,
                       project.created_at,
                       project.updated_at
                  FROM portfolio.projects AS project
                  JOIN portfolio.project_categories AS category
                    ON category.id = project.category_id
                 WHERE project.id = ?
                """,
                (resultSet, rowNumber) -> new AdminWorkRow(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("slug"),
                        resultSet.getString("category_code"),
                        resultSet.getString("category_name"),
                        resultSet.getString("status"),
                        resultSet.getString("publication_status"),
                        resultSet.getObject("started_on", LocalDate.class),
                        resultSet.getObject("completed_on", LocalDate.class),
                        resultSet.getBoolean("is_featured"),
                        resultSet.getObject("featured_order", Integer.class),
                        resultSet.getObject("published_at", OffsetDateTime.class),
                        resultSet.getObject("created_at", OffsetDateTime.class),
                        resultSet.getObject("updated_at", OffsetDateTime.class)
                ),
                id
        );

        return rows.stream().findFirst().map(row -> new AdminWorkResponse(
                row.id(),
                row.slug(),
                row.categoryCode(),
                row.categoryName(),
                row.status(),
                row.publicationStatus(),
                row.startedOn(),
                row.completedOn(),
                row.featured(),
                row.featuredOrder(),
                row.publishedAt(),
                row.createdAt(),
                row.updatedAt(),
                findPositionCodes(row.id()),
                findTechnologySlugs(row.id()),
                findTranslations(row.id())
        ));
    }

    public boolean categoryExists(String code) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM portfolio.project_categories
                     WHERE code = ?
                       AND is_active = true
                )
                """,
                Boolean.class,
                code
        );
        return Boolean.TRUE.equals(exists);
    }

    public boolean slugExists(String slug, UUID excludedId) {
        Boolean exists = jdbcTemplate.queryForObject(
                """
                SELECT EXISTS (
                    SELECT 1
                      FROM portfolio.projects
                     WHERE slug = ?
                       AND (?::uuid IS NULL OR id <> ?::uuid)
                )
                """,
                Boolean.class,
                slug,
                excludedId,
                excludedId
        );
        return Boolean.TRUE.equals(exists);
    }

    public UUID create(UUID actorId, CreateWorkRequest request) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO portfolio.projects (
                    slug,
                    category_id,
                    status,
                    started_on,
                    completed_on,
                    created_by,
                    updated_by
                )
                SELECT ?,
                       category.id,
                       ?::portfolio.project_status,
                       ?,
                       ?,
                       ?,
                       ?
                  FROM portfolio.project_categories AS category
                 WHERE category.code = ?
                RETURNING id
                """,
                UUID.class,
                request.slug(),
                request.status().name(),
                request.startedOn(),
                request.completedOn(),
                actorId,
                actorId,
                request.categoryCode()
        );
    }

    public boolean update(UUID actorId, UUID id, UpdateWorkRequest request) {
        return jdbcTemplate.update(
                """
                UPDATE portfolio.projects
                   SET slug = ?,
                       category_id = (
                           SELECT category.id
                             FROM portfolio.project_categories AS category
                            WHERE category.code = ?
                       ),
                       status = ?::portfolio.project_status,
                       started_on = ?,
                       completed_on = ?,
                       updated_by = ?
                 WHERE id = ?
                """,
                request.slug(),
                request.categoryCode(),
                request.status().name(),
                request.startedOn(),
                request.completedOn(),
                actorId,
                id
        ) == 1;
    }

    public boolean upsertTranslation(
            UUID projectId,
            String locale,
            UpsertWorkTranslationRequest request
    ) {
        return jdbcTemplate.update(
                """
                INSERT INTO portfolio.project_translations (
                    project_id,
                    locale,
                    name,
                    short_description,
                    overview,
                    feasibility,
                    target_users
                )
                SELECT id, ?, ?, ?, ?, ?, ?
                  FROM portfolio.projects
                 WHERE id = ?
                ON CONFLICT (project_id, locale)
                DO UPDATE SET
                    name = EXCLUDED.name,
                    short_description = EXCLUDED.short_description,
                    overview = EXCLUDED.overview,
                    feasibility = EXCLUDED.feasibility,
                    target_users = EXCLUDED.target_users
                """,
                locale,
                request.name().trim(),
                request.shortDescription().trim(),
                request.overview().trim(),
                request.feasibility().trim(),
                request.targetUsers().trim(),
                projectId
        ) == 1;
    }

    public int countActivePositions(List<String> codes) {
        if (codes.isEmpty()) {
            return 0;
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(codes.size(), "?"));
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                  FROM portfolio.positions
                 WHERE is_active = true
                   AND code IN (%s)
                """.formatted(placeholders),
                Integer.class,
                codes.toArray()
        );
        return count == null ? 0 : count;
    }

    public void replacePositions(UUID projectId, List<String> codes) {
        jdbcTemplate.update(
                "DELETE FROM portfolio.project_positions WHERE project_id = ?",
                projectId
        );
        for (int index = 0; index < codes.size(); index++) {
            jdbcTemplate.update(
                    """
                    INSERT INTO portfolio.project_positions (
                        project_id,
                        position_id,
                        sort_order
                    )
                    SELECT ?, id, ?
                      FROM portfolio.positions
                     WHERE code = ?
                    """,
                    projectId,
                    index,
                    codes.get(index)
            );
        }
    }

    public int countActiveTechnologies(List<String> slugs) {
        if (slugs.isEmpty()) {
            return 0;
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(slugs.size(), "?"));
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                  FROM portfolio.technologies
                 WHERE is_active = true
                   AND slug IN (%s)
                """.formatted(placeholders),
                Integer.class,
                slugs.toArray()
        );
        return count == null ? 0 : count;
    }

    public void replaceTechnologies(UUID projectId, List<String> slugs) {
        jdbcTemplate.update(
                "DELETE FROM portfolio.project_technologies WHERE project_id = ?",
                projectId
        );
        for (int index = 0; index < slugs.size(); index++) {
            jdbcTemplate.update(
                    """
                    INSERT INTO portfolio.project_technologies (
                        project_id,
                        technology_id,
                        sort_order
                    )
                    SELECT ?, id, ?
                      FROM portfolio.technologies
                     WHERE slug = ?
                    """,
                    projectId,
                    index,
                    slugs.get(index)
            );
        }
    }

    public List<AdminWorkLinkResponse> findLinks(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT id, link_type::text, label, url, sort_order
                  FROM portfolio.project_links
                 WHERE project_id = ?
                 ORDER BY sort_order, id
                """,
                (resultSet, rowNumber) -> new AdminWorkLinkResponse(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("link_type"),
                        resultSet.getString("label"),
                        resultSet.getString("url"),
                        resultSet.getInt("sort_order")
                ),
                projectId
        );
    }

    public Optional<AdminWorkLinkResponse> findLink(UUID projectId, UUID linkId) {
        return findLinks(projectId).stream()
                .filter(link -> link.id().equals(linkId))
                .findFirst();
    }

    public UUID createLink(UUID projectId, UpsertWorkLinkRequest request) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO portfolio.project_links (
                    project_id,
                    link_type,
                    label,
                    url,
                    sort_order
                )
                VALUES (?, ?::portfolio.project_link_type, ?, ?, ?)
                RETURNING id
                """,
                UUID.class,
                projectId,
                request.type().name(),
                request.label().trim(),
                request.url().trim(),
                request.sortOrder()
        );
    }

    public boolean updateLink(
            UUID projectId,
            UUID linkId,
            UpsertWorkLinkRequest request
    ) {
        return jdbcTemplate.update(
                """
                UPDATE portfolio.project_links
                   SET link_type = ?::portfolio.project_link_type,
                       label = ?,
                       url = ?,
                       sort_order = ?
                 WHERE id = ?
                   AND project_id = ?
                """,
                request.type().name(),
                request.label().trim(),
                request.url().trim(),
                request.sortOrder(),
                linkId,
                projectId
        ) == 1;
    }

    public boolean deleteLink(UUID projectId, UUID linkId) {
        return jdbcTemplate.update(
                """
                DELETE FROM portfolio.project_links
                 WHERE id = ?
                   AND project_id = ?
                """,
                linkId,
                projectId
        ) == 1;
    }

    public List<AdminWorkContentResponse> findContent(UUID projectId) {
        return jdbcTemplate.query(
                        """
                        SELECT id, content_type::text, sort_order
                          FROM portfolio.project_content_items
                         WHERE project_id = ?
                         ORDER BY content_type, sort_order, id
                        """,
                        (resultSet, rowNumber) -> new ContentRow(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getString("content_type"),
                                resultSet.getInt("sort_order")
                        ),
                        projectId
                ).stream()
                .map(row -> new AdminWorkContentResponse(
                        row.id(),
                        row.type(),
                        row.sortOrder(),
                        findContentTranslations(row.id())
                ))
                .toList();
    }

    public Optional<AdminWorkContentResponse> findContent(
            UUID projectId,
            UUID contentId
    ) {
        return findContent(projectId).stream()
                .filter(content -> content.id().equals(contentId))
                .findFirst();
    }

    public UUID createContent(UUID projectId, CreateWorkContentRequest request) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO portfolio.project_content_items (
                    project_id,
                    content_type,
                    sort_order
                )
                VALUES (?, ?::portfolio.project_content_type, ?)
                RETURNING id
                """,
                UUID.class,
                projectId,
                request.type().name(),
                request.sortOrder()
        );
    }

    public boolean updateContent(
            UUID projectId,
            UUID contentId,
            UpdateWorkContentRequest request
    ) {
        return jdbcTemplate.update(
                """
                UPDATE portfolio.project_content_items
                   SET content_type = ?::portfolio.project_content_type,
                       sort_order = ?
                 WHERE id = ?
                   AND project_id = ?
                """,
                request.type().name(),
                request.sortOrder(),
                contentId,
                projectId
        ) == 1;
    }

    public boolean upsertContentTranslation(
            UUID contentId,
            String locale,
            UpsertContentTranslationRequest request
    ) {
        return jdbcTemplate.update(
                """
                INSERT INTO portfolio.project_content_translations (
                    content_item_id,
                    locale,
                    title,
                    description
                )
                SELECT id, ?, ?, ?
                  FROM portfolio.project_content_items
                 WHERE id = ?
                ON CONFLICT (content_item_id, locale)
                DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description
                """,
                locale,
                request.title().trim(),
                request.description().trim(),
                contentId
        ) == 1;
    }

    public boolean deleteContent(UUID projectId, UUID contentId) {
        return jdbcTemplate.update(
                """
                DELETE FROM portfolio.project_content_items
                 WHERE id = ?
                   AND project_id = ?
                """,
                contentId,
                projectId
        ) == 1;
    }

    public void touch(UUID actorId, UUID projectId) {
        jdbcTemplate.update(
                """
                UPDATE portfolio.projects
                   SET updated_by = ?
                 WHERE id = ?
                """,
                actorId,
                projectId
        );
    }

    public List<AdminWorkMediaResponse> findMedia(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT id,
                       media_type::text,
                       secure_url,
                       width,
                       height,
                       format,
                       bytes,
                       alt_text,
                       sort_order
                  FROM portfolio.project_media
                 WHERE project_id = ?
                 ORDER BY media_type, sort_order, id
                """,
                (resultSet, rowNumber) -> new AdminWorkMediaResponse(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("media_type"),
                        resultSet.getString("secure_url"),
                        resultSet.getObject("width", Integer.class),
                        resultSet.getObject("height", Integer.class),
                        resultSet.getString("format"),
                        resultSet.getObject("bytes", Long.class),
                        resultSet.getString("alt_text"),
                        resultSet.getInt("sort_order")
                ),
                projectId
        );
    }

    public Optional<MediaRecord> findMediaRecord(UUID projectId, UUID mediaId) {
        return jdbcTemplate.query(
                """
                SELECT id,
                       cloudinary_public_id,
                       media_type::text,
                       secure_url,
                       width,
                       height,
                       format,
                       bytes,
                       alt_text,
                       sort_order
                  FROM portfolio.project_media
                 WHERE id = ?
                   AND project_id = ?
                """,
                (resultSet, rowNumber) -> new MediaRecord(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("cloudinary_public_id"),
                        new AdminWorkMediaResponse(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getString("media_type"),
                                resultSet.getString("secure_url"),
                                resultSet.getObject("width", Integer.class),
                                resultSet.getObject("height", Integer.class),
                                resultSet.getString("format"),
                                resultSet.getObject("bytes", Long.class),
                                resultSet.getString("alt_text"),
                                resultSet.getInt("sort_order")
                        )
                ),
                mediaId,
                projectId
        ).stream().findFirst();
    }

    public int countMedia(UUID projectId, String type) {
        Integer count = jdbcTemplate.queryForObject(
                """
                SELECT count(*)
                  FROM portfolio.project_media
                 WHERE project_id = ?
                   AND media_type = ?::portfolio.project_media_type
                """,
                Integer.class,
                projectId,
                type
        );
        return count == null ? 0 : count;
    }

    public UUID createMedia(
            UUID projectId,
            WorkMediaType type,
            CloudinaryService.UploadedMedia uploaded,
            String altText,
            int sortOrder
    ) {
        return jdbcTemplate.queryForObject(
                """
                INSERT INTO portfolio.project_media (
                    project_id,
                    media_type,
                    cloudinary_public_id,
                    secure_url,
                    width,
                    height,
                    format,
                    bytes,
                    alt_text,
                    sort_order
                )
                VALUES (?, ?::portfolio.project_media_type, ?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING id
                """,
                UUID.class,
                projectId,
                type.name(),
                uploaded.publicId(),
                uploaded.secureUrl(),
                uploaded.width(),
                uploaded.height(),
                uploaded.format(),
                uploaded.bytes(),
                normalize(altText),
                sortOrder
        );
    }

    public boolean updateMedia(
            UUID projectId,
            UUID mediaId,
            UpdateWorkMediaRequest request
    ) {
        return jdbcTemplate.update(
                """
                UPDATE portfolio.project_media
                   SET alt_text = ?,
                       sort_order = ?
                 WHERE id = ?
                   AND project_id = ?
                """,
                normalize(request.altText()),
                request.sortOrder(),
                mediaId,
                projectId
        ) == 1;
    }

    public boolean deleteMedia(UUID projectId, UUID mediaId) {
        return jdbcTemplate.update(
                """
                DELETE FROM portfolio.project_media
                 WHERE id = ?
                   AND project_id = ?
                """,
                mediaId,
                projectId
        ) == 1;
    }

    public PublishReadiness getPublishReadiness(UUID projectId) {
        return jdbcTemplate.queryForObject(
                """
                SELECT (
                           SELECT count(DISTINCT locale)
                             FROM portfolio.project_translations
                            WHERE project_id = ?
                              AND locale IN ('th', 'en')
                       ) AS translation_count,
                       (
                           SELECT count(*)
                             FROM portfolio.project_content_items AS item
                            WHERE item.project_id = ?
                              AND (
                                  NOT EXISTS (
                                      SELECT 1
                                        FROM portfolio.project_content_translations AS translation
                                       WHERE translation.content_item_id = item.id
                                         AND translation.locale = 'th'
                                  )
                                  OR NOT EXISTS (
                                      SELECT 1
                                        FROM portfolio.project_content_translations AS translation
                                       WHERE translation.content_item_id = item.id
                                         AND translation.locale = 'en'
                                  )
                              )
                       ) AS incomplete_content_count
                """,
                (resultSet, rowNumber) -> new PublishReadiness(
                        resultSet.getInt("translation_count"),
                        resultSet.getInt("incomplete_content_count")
                ),
                projectId,
                projectId
        );
    }

    public boolean publish(
            UUID actorId,
            UUID projectId,
            boolean featured,
            Integer featuredOrder
    ) {
        return jdbcTemplate.update(
                """
                UPDATE portfolio.projects
                   SET publication_status = 'PUBLISHED',
                       is_featured = ?,
                       featured_order = ?,
                       updated_by = ?
                 WHERE id = ?
                """,
                featured,
                featuredOrder,
                actorId,
                projectId
        ) == 1;
    }

    public boolean unpublish(UUID actorId, UUID projectId) {
        return jdbcTemplate.update(
                """
                UPDATE portfolio.projects
                   SET publication_status = 'DRAFT',
                       updated_by = ?
                 WHERE id = ?
                """,
                actorId,
                projectId
        ) == 1;
    }

    public boolean deleteDraft(UUID projectId) {
        return jdbcTemplate.update(
                """
                DELETE FROM portfolio.projects
                 WHERE id = ?
                   AND publication_status = 'DRAFT'
                """,
                projectId
        ) == 1;
    }

    private List<AdminWorkResponse.Translation> findTranslations(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT locale,
                       name,
                       short_description,
                       overview,
                       feasibility,
                       target_users
                  FROM portfolio.project_translations
                 WHERE project_id = ?
                 ORDER BY locale DESC
                """,
                (resultSet, rowNumber) -> new AdminWorkResponse.Translation(
                        resultSet.getString("locale"),
                        resultSet.getString("name"),
                        resultSet.getString("short_description"),
                        resultSet.getString("overview"),
                        resultSet.getString("feasibility"),
                        resultSet.getString("target_users")
                ),
                projectId
        );
    }

    private List<String> findPositionCodes(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT position.code
                  FROM portfolio.project_positions AS project_position
                  JOIN portfolio.positions AS position
                    ON position.id = project_position.position_id
                 WHERE project_position.project_id = ?
                 ORDER BY project_position.sort_order
                """,
                (resultSet, rowNumber) -> resultSet.getString("code"),
                projectId
        );
    }

    private List<String> findTechnologySlugs(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT technology.slug
                  FROM portfolio.project_technologies AS project_technology
                  JOIN portfolio.technologies AS technology
                    ON technology.id = project_technology.technology_id
                 WHERE project_technology.project_id = ?
                 ORDER BY project_technology.sort_order
                """,
                (resultSet, rowNumber) -> resultSet.getString("slug"),
                projectId
        );
    }

    private List<AdminWorkContentResponse.Translation> findContentTranslations(UUID contentId) {
        return jdbcTemplate.query(
                """
                SELECT locale, title, description
                  FROM portfolio.project_content_translations
                 WHERE content_item_id = ?
                 ORDER BY locale DESC
                """,
                (resultSet, rowNumber) -> new AdminWorkContentResponse.Translation(
                        resultSet.getString("locale"),
                        resultSet.getString("title"),
                        resultSet.getString("description")
                ),
                contentId
        );
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    public record PublishReadiness(int translationCount, int incompleteContentCount) {
    }

    public record MediaRecord(
            UUID id,
            String cloudinaryPublicId,
            AdminWorkMediaResponse response
    ) {
    }

    private record AdminWorkRow(
            UUID id,
            String slug,
            String categoryCode,
            String categoryName,
            String status,
            String publicationStatus,
            LocalDate startedOn,
            LocalDate completedOn,
            boolean featured,
            Integer featuredOrder,
            OffsetDateTime publishedAt,
            OffsetDateTime createdAt,
            OffsetDateTime updatedAt
    ) {
    }

    private record ContentRow(UUID id, String type, int sortOrder) {
    }
}
