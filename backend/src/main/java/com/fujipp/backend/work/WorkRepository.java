package com.fujipp.backend.work;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.math.BigDecimal;

@Repository
public class WorkRepository {

    private final JdbcTemplate jdbcTemplate;

    public WorkRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<WorkSummaryResponse> findPublished(
            String locale,
            String category,
            Boolean featured
    ) {
        List<ProjectRow> projects = jdbcTemplate.query(
                """
                SELECT project.id,
                       project.slug,
                       translation.name,
                       translation.short_description,
                       NULL::text AS overview,
                       NULL::text AS feasibility,
                       NULL::text AS target_users,
                       project.status::text,
                       project.started_on,
                       project.completed_on,
                       project.is_featured,
                       project.published_at,
                       category.code AS category_code,
                       category.name AS category_name
                  FROM portfolio.projects AS project
                  JOIN portfolio.project_translations AS translation
                    ON translation.project_id = project.id
                   AND translation.locale = ?
                  JOIN portfolio.project_categories AS category
                    ON category.id = project.category_id
                 WHERE project.publication_status = 'PUBLISHED'
                   AND (?::text IS NULL OR category.code = ?)
                   AND (?::boolean IS NULL OR project.is_featured = ?)
                 ORDER BY project.is_featured DESC,
                          project.featured_order ASC NULLS LAST,
                          project.published_at DESC,
                          project.slug ASC
                """,
                PROJECT_ROW_MAPPER,
                locale,
                category,
                category,
                featured,
                featured
        );

        return projects.stream()
                .map(project -> new WorkSummaryResponse(
                        project.slug(),
                        project.name(),
                        project.shortDescription(),
                        project.status(),
                        project.startedOn(),
                        project.completedOn(),
                        project.featured(),
                        project.category(),
                        findPositions(project.id()),
                        findTechnologies(project.id()),
                        findMedia(project.id(), "GALLERY").stream().findFirst().orElse(null)
                ))
                .toList();
    }

    public List<WorkPageRow> findPublishedPage(String locale,String category,Boolean featured,
            List<String> after,int limit) {
        String cursor=after.isEmpty()?"":"""
                   AND ROW(CASE WHEN project.is_featured THEN 0 ELSE 1 END,
                           COALESCE(project.featured_order,2147483647),
                           -extract(epoch from project.published_at),project.slug,project.id::text)
                       > ROW(?::int,?::int,?::numeric,?::text,?::text)
                """;
        String sql="""
                SELECT project.id,project.slug,translation.name,translation.short_description,
                       NULL::text AS overview,NULL::text AS feasibility,NULL::text AS target_users,
                       project.status::text,project.started_on,project.completed_on,project.is_featured,
                       project.featured_order,project.published_at,category.code AS category_code,category.name AS category_name
                  FROM portfolio.projects project JOIN portfolio.project_translations translation
                    ON translation.project_id=project.id AND translation.locale=?
                  JOIN portfolio.project_categories category ON category.id=project.category_id
                 WHERE project.publication_status='PUBLISHED' AND (?::text IS NULL OR category.code=?)
                   AND (?::boolean IS NULL OR project.is_featured=?)
                """+cursor+"""
                 ORDER BY project.is_featured DESC,project.featured_order ASC NULLS LAST,
                          project.published_at DESC,project.slug,project.id LIMIT ?
                """;
        Object[] base=after.isEmpty()
                ?new Object[]{locale,category,category,featured,featured,limit}
                :new Object[]{locale,category,category,featured,featured,after.get(0),after.get(1),after.get(2),after.get(3),after.get(4),limit};
        return jdbcTemplate.query(sql,(rs,n)->{
            ProjectRow project=PROJECT_ROW_MAPPER.mapRow(rs,n);
            WorkSummaryResponse item=new WorkSummaryResponse(project.slug(),project.name(),project.shortDescription(),
                    project.status(),project.startedOn(),project.completedOn(),project.featured(),project.category(),
                    findPositions(project.id()),findTechnologies(project.id()),findMedia(project.id(),"GALLERY").stream().findFirst().orElse(null));
            int order=rs.getObject("featured_order",Integer.class)==null?2147483647:rs.getInt("featured_order");
            var instant=project.publishedAt().toInstant();
            String epochSort=BigDecimal.valueOf(instant.getEpochSecond())
                    .add(BigDecimal.valueOf(instant.getNano(),9)).negate().stripTrailingZeros().toPlainString();
            return new WorkPageRow(item,project.id(),project.featured()?0:1,order,epochSort,project.slug());
        },base);
    }

    public Optional<WorkDetailResponse> findPublishedBySlug(String slug, String locale) {
        List<ProjectRow> projects = jdbcTemplate.query(
                """
                SELECT project.id,
                       project.slug,
                       translation.name,
                       translation.short_description,
                       translation.overview,
                       translation.feasibility,
                       translation.target_users,
                       project.status::text,
                       project.started_on,
                       project.completed_on,
                       project.is_featured,
                       project.published_at,
                       category.code AS category_code,
                       category.name AS category_name
                  FROM portfolio.projects AS project
                  JOIN portfolio.project_translations AS translation
                    ON translation.project_id = project.id
                   AND translation.locale = ?
                  JOIN portfolio.project_categories AS category
                    ON category.id = project.category_id
                 WHERE project.slug = ?
                   AND project.publication_status = 'PUBLISHED'
                """,
                PROJECT_ROW_MAPPER,
                locale,
                slug
        );

        return projects.stream().findFirst().map(project -> {
            List<Media> architecture = findMedia(project.id(), "ARCHITECTURE");
            return new WorkDetailResponse(
                    project.slug(),
                    project.name(),
                    project.shortDescription(),
                    project.overview(),
                    project.feasibility(),
                    project.targetUsers(),
                    project.status(),
                    project.startedOn(),
                    project.completedOn(),
                    project.featured(),
                    project.publishedAt(),
                    project.category(),
                    findPositions(project.id()),
                    findTechnologies(project.id()),
                    findMedia(project.id(), "GALLERY"),
                    architecture.stream().findFirst().orElse(null),
                    findLinks(project.id()),
                    findContent(project.id(), locale, "FEATURE"),
                    findContent(project.id(), locale, "CHALLENGE"),
                    findContent(project.id(), locale, "LEARNING")
            );
        });
    }

    private List<Position> findPositions(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT position.code, position.name
                  FROM portfolio.project_positions AS project_position
                  JOIN portfolio.positions AS position
                    ON position.id = project_position.position_id
                 WHERE project_position.project_id = ?
                 ORDER BY project_position.sort_order, position.code
                """,
                (resultSet, rowNumber) -> new Position(
                        resultSet.getString("code"),
                        resultSet.getString("name")
                ),
                projectId
        );
    }

    private List<Technology> findTechnologies(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT technology.slug,
                       technology.name,
                       technology.icon_url,
                       technology.official_url,
                       technology_group.code AS group_code,
                       technology_group.name AS group_name
                  FROM portfolio.project_technologies AS project_technology
                  JOIN portfolio.technologies AS technology
                    ON technology.id = project_technology.technology_id
                  JOIN portfolio.technology_groups AS technology_group
                    ON technology_group.id = technology.group_id
                 WHERE project_technology.project_id = ?
                 ORDER BY project_technology.sort_order, technology.slug
                """,
                (resultSet, rowNumber) -> new Technology(
                        resultSet.getString("slug"),
                        resultSet.getString("name"),
                        resultSet.getString("icon_url"),
                        resultSet.getString("official_url"),
                        new TechnologyGroup(
                                resultSet.getString("group_code"),
                                resultSet.getString("group_name")
                        )
                ),
                projectId
        );
    }

    private List<Media> findMedia(UUID projectId, String mediaType) {
        return jdbcTemplate.query(
                """
                SELECT secure_url, width, height, format, bytes, alt_text
                  FROM portfolio.project_media
                 WHERE project_id = ?
                   AND media_type = ?::portfolio.project_media_type
                 ORDER BY sort_order, id
                """,
                (resultSet, rowNumber) -> new Media(
                        resultSet.getString("secure_url"),
                        resultSet.getObject("width", Integer.class),
                        resultSet.getObject("height", Integer.class),
                        resultSet.getString("format"),
                        resultSet.getObject("bytes", Long.class),
                        resultSet.getString("alt_text")
                ),
                projectId,
                mediaType
        );
    }

    private List<Link> findLinks(UUID projectId) {
        return jdbcTemplate.query(
                """
                SELECT link_type::text, label, url
                  FROM portfolio.project_links
                 WHERE project_id = ?
                 ORDER BY sort_order, id
                """,
                (resultSet, rowNumber) -> new Link(
                        resultSet.getString("link_type"),
                        resultSet.getString("label"),
                        resultSet.getString("url")
                ),
                projectId
        );
    }

    private List<ContentItem> findContent(UUID projectId, String locale, String contentType) {
        return jdbcTemplate.query(
                """
                SELECT translation.title, translation.description
                  FROM portfolio.project_content_items AS item
                  JOIN portfolio.project_content_translations AS translation
                    ON translation.content_item_id = item.id
                   AND translation.locale = ?
                 WHERE item.project_id = ?
                   AND item.content_type = ?::portfolio.project_content_type
                 ORDER BY item.sort_order, item.id
                """,
                (resultSet, rowNumber) -> new ContentItem(
                        resultSet.getString("title"),
                        resultSet.getString("description")
                ),
                locale,
                projectId,
                contentType
        );
    }

    private static final org.springframework.jdbc.core.RowMapper<ProjectRow> PROJECT_ROW_MAPPER =
            (resultSet, rowNumber) -> new ProjectRow(
                    resultSet.getObject("id", UUID.class),
                    resultSet.getString("slug"),
                    resultSet.getString("name"),
                    resultSet.getString("short_description"),
                    resultSet.getString("overview"),
                    resultSet.getString("feasibility"),
                    resultSet.getString("target_users"),
                    resultSet.getString("status"),
                    resultSet.getObject("started_on", LocalDate.class),
                    resultSet.getObject("completed_on", LocalDate.class),
                    resultSet.getBoolean("is_featured"),
                    resultSet.getObject("published_at", OffsetDateTime.class),
                    new Category(
                            resultSet.getString("category_code"),
                            resultSet.getString("category_name")
                    )
            );

    private record ProjectRow(
            UUID id,
            String slug,
            String name,
            String shortDescription,
            String overview,
            String feasibility,
            String targetUsers,
            String status,
            LocalDate startedOn,
            LocalDate completedOn,
            boolean featured,
            OffsetDateTime publishedAt,
            Category category
    ) {
    }

    public record Category(String code, String name) {
    }

    public record Position(String code, String name) {
    }

    public record TechnologyGroup(String code, String name) {
    }

    public record Technology(
            String slug,
            String name,
            String iconUrl,
            String officialUrl,
            TechnologyGroup group
    ) {
    }

    public record Media(
            String url,
            Integer width,
            Integer height,
            String format,
            Long bytes,
            String altText
    ) {
    }

    public record Link(String type, String label, String url) {
    }

    public record ContentItem(String title, String description) {
    }

    public record WorkPageRow(WorkSummaryResponse item,UUID id,int featuredSort,int featuredOrder,
                              String publishedEpochSort,String slug){}
}
