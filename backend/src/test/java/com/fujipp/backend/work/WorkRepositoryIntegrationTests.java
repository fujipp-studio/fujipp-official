package com.fujipp.backend.work;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@EnabledIfEnvironmentVariable(
        named = "WORK_INTEGRATION_TESTS",
        matches = "true"
)
class WorkRepositoryIntegrationTests {

    @Test
    void listsPublishedWorksWithNullOptionalFilters() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:postgresql://127.0.0.1:54322/postgres",
                "postgres",
                "postgres"
        );
        WorkRepository repository = new WorkRepository(new JdbcTemplate(dataSource));

        List<WorkSummaryResponse> works = repository.findPublished(
                "th",
                null,
                null
        );

        assertThat(works)
                .extracting(WorkSummaryResponse::slug)
                .contains("fujipp-official");
    }
}
