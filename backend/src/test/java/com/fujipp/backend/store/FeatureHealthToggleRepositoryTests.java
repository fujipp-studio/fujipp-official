package com.fujipp.backend.store;

import com.fujipp.backend.runtime.RuntimeRepository;
import com.fujipp.backend.runtime.RuntimeStatusRequest;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.json.JsonMapper;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class FeatureHealthToggleRepositoryTests {
    private JdbcTemplate jdbc;
    private FeatureHealthRepository repository;
    private final UUID bot=UUID.randomUUID(),owner=UUID.randomUUID(),installation=UUID.randomUUID(),license=UUID.randomUUID(),product=UUID.randomUUID();
    @BeforeEach void database() {
        jdbc=new JdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1","sa",""));
        jdbc.execute("CREATE SCHEMA private; CREATE SCHEMA bots; CREATE SCHEMA shop");
        jdbc.execute("CREATE DOMAIN private.feature_installation_status AS VARCHAR");
        jdbc.execute("CREATE TABLE bots.bot_instances(id UUID,owner_user_id UUID,status VARCHAR)");
        jdbc.execute("CREATE TABLE shop.feature_products(id UUID,code VARCHAR)");
        jdbc.execute("CREATE TABLE private.feature_licenses(id UUID,status VARCHAR,expires_at TIMESTAMP WITH TIME ZONE)");
        jdbc.execute("CREATE TABLE private.bot_feature_installations(id UUID,bot_id UUID,owner_user_id UUID,license_id UUID,feature_product_id UUID,status private.feature_installation_status,removed_at TIMESTAMP WITH TIME ZONE,last_error_code VARCHAR,last_error_message VARCHAR,last_error_category VARCHAR,last_error_at TIMESTAMP WITH TIME ZONE,recovery_attempts INT,next_retry_at TIMESTAMP WITH TIME ZONE)");
        jdbc.update("INSERT INTO bots.bot_instances VALUES (?,?,'STOPPED')",bot,owner);
        jdbc.update("INSERT INTO shop.feature_products VALUES (?,'voice-keeper')",product);
        jdbc.update("INSERT INTO private.feature_licenses VALUES (?,'ACTIVE',NULL)",license);
        jdbc.update("INSERT INTO private.bot_feature_installations(id,bot_id,owner_user_id,license_id,feature_product_id,status,last_error_code,recovery_attempts,next_retry_at) VALUES (?,?,?,?,?,'ERROR','FEATURE_ACTIVATION_FAILED',2,now())",installation,bot,owner,license,product);
        repository=new FeatureHealthRepository(jdbc);
    }
    @AfterEach void close() { jdbc.execute("SHUTDOWN"); }
    private String status() { return jdbc.queryForObject("SELECT status FROM private.bot_feature_installations WHERE id=?",String.class,installation); }
    @Test void disableThenEnableRetainsInstallationAndClearsRetry() {
        assertThat(repository.setEnabled(bot,installation,owner,"ERROR","DISABLED")).isTrue();
        assertThat(status()).isEqualTo("DISABLED");
        assertThat(jdbc.queryForObject("SELECT next_retry_at IS NULL AND last_error_code IS NULL AND recovery_attempts=0 AND removed_at IS NULL FROM private.bot_feature_installations",Boolean.class)).isTrue();
        assertThat(repository.setEnabled(bot,installation,owner,"DISABLED","INSTALLING")).isTrue();
        assertThat(status()).isEqualTo("INSTALLING");
    }
    @Test void staleOrForeignRequestsCannotUpdateInstallation() {
        assertThat(repository.setEnabled(bot,installation,UUID.randomUUID(),"ERROR","DISABLED")).isFalse();
        assertThat(repository.setEnabled(UUID.randomUUID(),installation,owner,"ERROR","DISABLED")).isFalse();
        assertThat(repository.setEnabled(bot,installation,owner,"ACTIVE","DISABLED")).isFalse();
        assertThat(status()).isEqualTo("ERROR");
    }
    @Test void invalidLicenseOrRemovedInstallationCannotEnable() {
        jdbc.update("UPDATE private.bot_feature_installations SET status='DISABLED'");
        jdbc.update("UPDATE private.feature_licenses SET status='REVOKED'");
        assertThat(repository.setEnabled(bot,installation,owner,"DISABLED","INSTALLING")).isFalse();
        jdbc.update("UPDATE private.feature_licenses SET status='ACTIVE',expires_at=now()-interval '1' day");
        assertThat(repository.setEnabled(bot,installation,owner,"DISABLED","INSTALLING")).isFalse();
        jdbc.update("UPDATE private.feature_licenses SET expires_at=NULL");
        jdbc.update("UPDATE private.bot_feature_installations SET removed_at=now()");
        assertThat(repository.setEnabled(bot,installation,owner,"DISABLED","INSTALLING")).isFalse();
        assertThat(status()).isEqualTo("DISABLED");
    }
    @Test void lateRunnerReportsCannotUndoUserDisableOrScheduleRecovery() {
        repository.setEnabled(bot,installation,owner,"ERROR","DISABLED");
        var runtime=new RuntimeRepository(jdbc,JsonMapper.builder().build());
        for (String report:new String[]{"ACTIVE","ERROR","INSTALLING"}) {
            runtime.updateStatus(new RuntimeStatusRequest(bot,installation,report,"FEATURE_ACTIVATION_FAILED","Timeout",null,null,"TRANSIENT"));
            assertThat(status()).isEqualTo("DISABLED");
            assertThat(jdbc.queryForObject("SELECT next_retry_at IS NULL AND last_error_code IS NULL FROM private.bot_feature_installations",Boolean.class)).isTrue();
        }
    }
}
