package com.fujipp.backend.store;

import com.fujipp.backend.runtime.RuntimeRepository;
import com.fujipp.backend.runtime.RuntimeStatusRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.support.JdbcTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

/** Real PostgreSQL coverage for enum casts, retry deadlines, eligibility and CAS. All rows roll back. */
@EnabledIfEnvironmentVariable(named="FEATURE_HEALTH_INTEGRATION_TESTS",matches="true")
class FeatureHealthRepositoryIntegrationTests {
    @Test void boundedStartupRecoveryNeverReplaysFinancialOrOperationFailures() {
        var source=new DriverManagerDataSource(System.getenv().getOrDefault("STORE_TEST_DB_URL","jdbc:postgresql://127.0.0.1:55432/postgres"),"postgres","postgres");
        var jdbc=new JdbcTemplate(source);
        new TransactionTemplate(new JdbcTransactionManager(source)).executeWithoutResult(tx->{
            tx.setRollbackOnly();
            UUID owner=UUID.randomUUID(),bot=UUID.randomUUID();
            jdbc.update("INSERT INTO auth.users(id) VALUES (?)",owner);
            jdbc.update("INSERT INTO bots.bot_instances(id,owner_user_id,name,desired_state) VALUES (?,?,?,'RUNNING')",bot,owner,"Health integration "+bot);
            UUID slot=jdbc.queryForObject("INSERT INTO private.runtime_slots(slot_number) SELECT coalesce(max(slot_number),0)+1 FROM private.runtime_slots RETURNING id",UUID.class);
            jdbc.update("INSERT INTO private.runtime_subscriptions(owner_user_id,runtime_slot_id,plan_id,bot_id,current_period_end) SELECT ?,?,id,?,now()+interval '1 day' FROM shop.runtime_plans LIMIT 1",owner,slot,bot);
            var health=new FeatureHealthRepository(jdbc);
            var runtime=new RuntimeRepository(jdbc,JsonMapper.builder().build());
            UUID price=install(jdbc,owner,bot,"price-reader"),wallet=install(jdbc,owner,bot,"wallet-topup");
            for (UUID id:new UUID[]{price,wallet}) runtime.updateStatus(new RuntimeStatusRequest(bot,id,"ERROR","FEATURE_ACTIVATION_FAILED","fetch failed",null,null,"TRANSIENT"));
            assertThat(health.list(bot).stream().filter(row->row.id().equals(price) || row.id().equals(wallet))).allSatisfy(row->assertThat(row.canRetry()).isTrue());
            assertThat(jdbc.queryForObject("SELECT extract(epoch FROM next_retry_at-now())::integer FROM private.bot_feature_installations WHERE id=?",Integer.class,price)).isEqualTo(30);
            assertThat(jdbc.queryForObject("SELECT next_retry_at IS NULL FROM private.bot_feature_installations WHERE id=?",Boolean.class,wallet)).isTrue();
            for (int attempt=1;attempt<=3;attempt++) {
                jdbc.update("UPDATE private.bot_feature_installations SET next_retry_at=now()-interval '1 second' WHERE id=?",price);
                assertThat(health.retryDue()).isEqualTo(1);
                assertThat(health.retryDue()).isZero();
                assertThat(jdbc.queryForObject("SELECT recovery_attempts FROM private.bot_feature_installations WHERE id=?",Integer.class,price)).isEqualTo(attempt);
                runtime.updateStatus(new RuntimeStatusRequest(bot,price,"ERROR","FEATURE_ACTIVATION_FAILED","timeout",null,null,"TRANSIENT"));
            }
            assertThat(health.retryDue()).isZero();
            assertThat(jdbc.queryForObject("SELECT next_retry_at IS NULL FROM private.bot_feature_installations WHERE id=?",Boolean.class,price)).isTrue();
            assertThat(health.retry(bot,price,UUID.randomUUID())).isFalse();
            assertThat(health.retry(bot,price,owner)).isTrue();
            assertThat(health.retry(bot,price,owner)).isFalse();
            runtime.updateStatus(new RuntimeStatusRequest(bot,price,"ACTIVE",null,null));
            assertThat(health.list(bot).stream().filter(row->row.id().equals(price)).findFirst().orElseThrow().attempts()).isZero();
            runtime.updateStatus(new RuntimeStatusRequest(bot,price,"ERROR","PAYMENT_FAILED","timeout"));
            jdbc.update("UPDATE private.bot_feature_installations SET next_retry_at=now()-interval '1 second' WHERE id=?",price);
            assertThat(health.retryDue()).isZero();
            assertThat(health.retry(bot,price,owner)).isFalse();
            runtime.updateStatus(new RuntimeStatusRequest(bot,price,"ERROR","FEATURE_ACTIVATION_FAILED","required"));
            assertThat(health.list(bot).stream().filter(row->row.id().equals(price)).findFirst().orElseThrow().response().errorCategory()).isEqualTo("CONFIGURATION");
            jdbc.update("UPDATE private.runtime_subscriptions SET status='CANCELLED' WHERE bot_id=?",bot);
            assertThat(health.retry(bot,price,owner)).isFalse();
            assertThat(health.list(bot)).allSatisfy(row->assertThat(row.canRetry()).isFalse());
        });
    }
    private UUID install(JdbcTemplate jdbc,UUID owner,UUID bot,String feature) {
        UUID product=jdbc.queryForObject("SELECT id FROM shop.feature_products WHERE code=?",UUID.class,feature);
        var published=jdbc.queryForList("SELECT id FROM shop.feature_versions WHERE feature_product_id=? AND status='PUBLISHED'",UUID.class,product);
        UUID version=published.isEmpty() ? jdbc.queryForObject("INSERT INTO shop.feature_versions(feature_product_id,version,runtime_key,status,published_at) VALUES (?,'99.0.0',?,'PUBLISHED',now()) RETURNING id",UUID.class,product,feature) : published.getFirst();
        UUID license=jdbc.queryForObject("INSERT INTO private.feature_licenses(owner_user_id,feature_product_id,acquired_version_id,source,granted_by) VALUES (?,?,?,'GRANT',?) RETURNING id",UUID.class,owner,product,version,owner);
        return jdbc.queryForObject("INSERT INTO private.bot_feature_installations(license_id,owner_user_id,bot_id,feature_product_id,feature_version_id) VALUES (?,?,?,?,?) RETURNING id",UUID.class,license,owner,bot,product,version);
    }
}
