package com.fujipp.backend.spending;

import com.fujipp.backend.auth.*;
import com.fujipp.backend.store.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Requires a disposable, empty database; never runs against application databases. */
@EnabledIfEnvironmentVariable(named="SPENDING_BACKUP_TEST_DB_URL",matches=".+")
class MemberSpendingBackupPostgresTests {
    static JdbcTemplate jdbc;
    static TransactionTemplate tx;
    final UUID bot=UUID.randomUUID(),owner=UUID.randomUUID(),license=UUID.randomUUID(),installation=UUID.randomUUID();
    final StoreRepository bots=mock(StoreRepository.class);
    final AdminBotRepository admins=mock(AdminBotRepository.class);
    final CurrentUserService users=mock(CurrentUserService.class);
    final Clock clock=Clock.fixed(Instant.parse("2026-11-21T16:59:59Z"),ZoneOffset.UTC);
    MemberSpendingBackupService service;

    @BeforeAll static void initialize() throws Exception {
        var source=new DriverManagerDataSource(System.getenv("SPENDING_BACKUP_TEST_DB_URL"),
            System.getenv("SPENDING_BACKUP_TEST_DB_USER"),System.getenv("SPENDING_BACKUP_TEST_DB_PASSWORD"));
        jdbc=new JdbcTemplate(source);
        assertThat(jdbc.queryForObject("SELECT current_database()",String.class)).startsWith("spending_backup_test_");
        tx=new TransactionTemplate(new DataSourceTransactionManager(source));
        jdbc.execute("""
            CREATE SCHEMA private; CREATE SCHEMA shop;
            CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE fujipp_backend;
            CREATE TABLE shop.feature_products(id UUID PRIMARY KEY,code TEXT);
            CREATE TABLE private.bot_feature_installations(id UUID PRIMARY KEY,bot_id UUID,license_id UUID,feature_product_id UUID,removed_at TIMESTAMPTZ);
            CREATE TABLE private.feature_config_sets(id UUID PRIMARY KEY,license_id UUID,feature_version_id UUID);
            CREATE TABLE shop.feature_config_definitions(id UUID PRIMARY KEY,feature_version_id UUID,config_key TEXT,default_value JSONB);
            CREATE TABLE private.feature_config_values(config_set_id UUID,definition_id UUID,value JSONB);
            CREATE TABLE private.member_spending(bot_id UUID,member_discord_id TEXT,amount_satang BIGINT,tx_count INTEGER,updated_at TIMESTAMPTZ DEFAULT now());
            CREATE TABLE private.member_spending_monthly(bot_id UUID,member_discord_id TEXT,month DATE,amount_satang BIGINT,tx_count INTEGER);
            CREATE TABLE private.member_spending_operations(bot_id UUID);
            """);
        Path migration=Path.of("supabase/migrations/20261121000001_member_spending_backup.sql");
        if(!Files.exists(migration)) migration=Path.of("../supabase/migrations/20261121000001_member_spending_backup.sql");
        jdbc.execute(Files.readString(migration));
        Path checks=Path.of("deploy/postgres/checks/member-spending.sql");
        if(!Files.exists(checks)) checks=Path.of("../deploy/postgres/checks/member-spending.sql");
        jdbc.execute(Files.readString(checks));
    }
    @BeforeEach void seed() {
        when(users.getActiveAccount("subject")).thenReturn(new CurrentUserRepository.AccountProfile(owner,AppRole.USER,AccountStatus.ACTIVE,"user","User",null,null,null,null));
        when(bots.findOwnedBot(bot,owner)).thenReturn(Optional.of(new BotResponse(bot,"Bot",null,"123456789012345678",null,null,"RUNNING","RUNNING",0,null,null)));
        UUID product=UUID.randomUUID(),version=UUID.randomUUID(),config=UUID.randomUUID(),definition=UUID.randomUUID();
        jdbc.update("INSERT INTO shop.feature_products VALUES(?,'member-spending')",product);
        jdbc.update("INSERT INTO private.bot_feature_installations VALUES(?,?,?,?,NULL)",installation,bot,license,product);
        jdbc.update("INSERT INTO private.feature_config_sets VALUES(?,?,?)",config,license,version);
        jdbc.update("INSERT INTO shop.feature_config_definitions VALUES(?,?,'SPENDING_DB_USE_OWN','false')",definition,version);
        jdbc.update("INSERT INTO private.member_spending VALUES(?,'222222222222222222',9223372036854775807,10,now())",bot);
        jdbc.update("INSERT INTO private.member_spending_monthly VALUES(?,'222222222222222222','2026-10-01',10000,1)",bot);
        service=new MemberSpendingBackupService(jdbc,bots,admins,users,new ObjectMapper(),clock);
    }
    @Test void concurrentRequestsAcrossServiceInstancesOnlyGenerateFiveArchives() throws Exception {
        var second=new MemberSpendingBackupService(jdbc,bots,admins,users,new ObjectMapper(),clock);
        try(var workers=Executors.newFixedThreadPool(10)) {
            var start=new CountDownLatch(1);
            var results=new ArrayList<Future<Boolean>>();
            for(int i=0;i<10;i++) {
                var selected=i%2==0?service:second;
                results.add(workers.submit(()->{
                    start.await();
                    try {
                        tx.execute(status->selected.download("subject",bot,license,false));
                        return true;
                    } catch(ResponseStatusException error) {
                        assertThat(error.getStatusCode().value()).isEqualTo(429);
                        return false;
                    }
                }));
            }
            start.countDown();
            int successes=0;
            for(var result:results) if(result.get(30,TimeUnit.SECONDS)) successes++;
            assertThat(successes).isEqualTo(5);
        }
        assertThat(service.quota("subject",bot,license,false).remaining()).isZero();
        assertThat(jdbc.queryForObject("SELECT download_count FROM private.member_spending_backup_quotas WHERE installation_id=?",Integer.class,installation)).isEqualTo(5);
    }
    @Test void midnightStartsANewDayWithoutChangingPreviousCount() {
        for(int i=0;i<5;i++) tx.execute(status->service.download("subject",bot,license,false));
        var next=new MemberSpendingBackupService(jdbc,bots,admins,users,new ObjectMapper(),Clock.fixed(Instant.parse("2026-11-21T17:00:00Z"),ZoneOffset.UTC));
        assertThat(next.quota("subject",bot,license,false).remaining()).isEqualTo(5);
        tx.execute(status->next.download("subject",bot,license,false));
        assertThat(next.quota("subject",bot,license,false).remaining()).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM private.member_spending_backup_quotas WHERE installation_id=?",Integer.class,installation)).isEqualTo(2);
    }
    @Test void transactionFailureAfterGenerationRollsBackQuotaAndAllowsRetry() {
        assertThatThrownBy(()->tx.execute(status->{
            service.download("subject",bot,license,false);
            throw new IllegalStateException("simulate commit-path failure");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(service.quota("subject",bot,license,false).remaining()).isEqualTo(5);
        tx.execute(status->service.download("subject",bot,license,false));
        assertThat(service.quota("subject",bot,license,false).remaining()).isEqualTo(4);
    }
    @Test void savedExternalStorageIsRejectedEvenIfTheBrowserSendsAPost() {
        jdbc.update("INSERT INTO private.feature_config_values SELECT c.id,d.id,'true'::jsonb FROM private.feature_config_sets c JOIN shop.feature_config_definitions d ON d.feature_version_id=c.feature_version_id WHERE c.license_id=?",license);
        assertThatThrownBy(()->tx.execute(status->service.download("subject",bot,license,false))).isInstanceOf(StoreConflictException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM private.member_spending_backup_quotas WHERE installation_id=?",Integer.class,installation)).isZero();
    }
}
