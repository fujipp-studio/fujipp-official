package com.fujipp.backend.site;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/** Run against local Supabase after applying the migration. All writes roll back. */
@EnabledIfEnvironmentVariable(named = "SEASONAL_INTEGRATION_TESTS", matches = "true")
class SeasonalEffectRepositoryIntegrationTests {
    @Test
    void savesAndReadsEveryEffectWithoutLeavingTheLocalSettingChanged() {
        var dataSource = new DriverManagerDataSource(
                "jdbc:postgresql://127.0.0.1:54322/postgres", "postgres", "postgres");
        var repository = new SeasonalEffectRepository(new JdbcTemplate(dataSource));
        new TransactionTemplate(new DataSourceTransactionManager(dataSource)).executeWithoutResult(status -> {
            status.setRollbackOnly();
            for (SeasonalEffect effect : SeasonalEffect.values()) {
                var updated = repository.update(effect, null);
                assertThat(updated.effect()).isEqualTo(effect);
                assertThat(updated.updatedAt()).isNotNull();
                assertThat(repository.get()).isEqualTo(updated);
            }
        });
    }
}
