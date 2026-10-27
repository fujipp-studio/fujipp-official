package com.fujipp.backend.roleshop;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="ROLE_SHOP_TEST_DB_URL",matches=".+")
class RoleShopPostgresTests {
    static JdbcTemplate jdbc;
    static TransactionTemplate tx;
    static RoleShopService service;
    static final String MEMBER="222222222222222222", ROLE="333333333333333333", OTHER_ROLE="444444444444444444";
    UUID bot;
    @BeforeAll static void disposableDatabase() throws Exception {
        var source=new DriverManagerDataSource(System.getenv("ROLE_SHOP_TEST_DB_URL"),"postgres","role-shop-test");
        jdbc=new JdbcTemplate(source);
        assertThat(jdbc.queryForObject("SELECT current_database()",String.class)).startsWith("role_shop_test_");
        jdbc.execute("""
            DO $$ BEGIN
              IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
              IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
              IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
            END $$;
            CREATE SCHEMA private; CREATE SCHEMA bots; CREATE SCHEMA shop;
            CREATE TYPE private.wallet_entry_kind AS ENUM ('TOPUP','DEBIT','ADJUSTMENT');
            CREATE TABLE bots.bot_instances(id UUID PRIMARY KEY);
            CREATE TABLE private.member_wallets(bot_id UUID,member_discord_id TEXT,balance_satang BIGINT NOT NULL DEFAULT 0 CHECK(balance_satang>=0),PRIMARY KEY(bot_id,member_discord_id));
            CREATE TABLE private.member_wallet_entries(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),bot_id UUID,member_discord_id TEXT,
              kind private.wallet_entry_kind,amount_satang BIGINT NOT NULL CHECK(amount_satang<>0),balance_after_satang BIGINT NOT NULL CHECK(balance_after_satang>=0),
              source_reference TEXT,idempotency_key VARCHAR(120),metadata JSONB,UNIQUE(bot_id,idempotency_key));
            CREATE TABLE shop.feature_products(id UUID PRIMARY KEY,code TEXT UNIQUE,name TEXT,description TEXT,category TEXT,icon_key TEXT,status TEXT,sort_order INT);
            CREATE TABLE shop.feature_versions(id UUID PRIMARY KEY,feature_product_id UUID,version TEXT,runtime_key TEXT,changelog TEXT,status TEXT);
            CREATE TABLE shop.feature_config_definitions(id UUID DEFAULT gen_random_uuid(),feature_version_id UUID,config_key TEXT,label TEXT,description TEXT,value_type TEXT,
              is_required BOOLEAN,is_secret BOOLEAN,default_value JSONB,validation_schema JSONB,ui_metadata JSONB,sort_order INT);
            CREATE TABLE shop.feature_presentation_slots(feature_version_id UUID,slot_key TEXT,label TEXT,description TEXT,presentation_type TEXT,
              available_variables TEXT[],default_definition JSONB,validation_schema JSONB,sort_order INT);
            CREATE TABLE private.feature_licenses(id UUID PRIMARY KEY,status TEXT,expires_at TIMESTAMPTZ);
            CREATE TABLE private.bot_feature_installations(bot_id UUID,license_id UUID,feature_product_id UUID,status TEXT,removed_at TIMESTAMPTZ);
            CREATE TABLE private.feature_config_sets(id UUID PRIMARY KEY,license_id UUID,feature_version_id UUID);
            CREATE TABLE private.feature_config_values(config_set_id UUID,definition_id UUID,value JSONB);
            """);
        // Execute the shipping migration, including RLS, grants, product definitions and presentation JSON.
        jdbc.execute(Files.readString(Path.of("../supabase/migrations/20261027000001_create_role_shop.sql")));
        jdbc.update("INSERT INTO shop.feature_products(id,code) VALUES ('e0600000-0000-0000-0000-000000000001','wallet-topup')");
        tx=new TransactionTemplate(new DataSourceTransactionManager(source));
        service=new RoleShopService(jdbc,JsonMapper.builder().build());
    }
    @BeforeEach void seed() {
        bot=UUID.randomUUID();
        jdbc.update("INSERT INTO bots.bot_instances VALUES (?)",bot);
        jdbc.update("INSERT INTO private.member_wallets VALUES (?,?,20000)",bot,MEMBER);
        UUID license=UUID.randomUUID(),wallet=UUID.randomUUID(),config=UUID.randomUUID();
        jdbc.update("INSERT INTO private.feature_licenses VALUES (?,'ACTIVE',NULL),(?,'ACTIVE',NULL)",license,wallet);
        jdbc.update("""
            INSERT INTO private.bot_feature_installations VALUES
            (?,?,'e0800000-0000-0000-0000-000000000001','ACTIVE',NULL),
            (?,?,'e0600000-0000-0000-0000-000000000001','ACTIVE',NULL)
            """,bot,license,bot,wallet);
        jdbc.update("INSERT INTO private.feature_config_sets VALUES (?,?,'e0800000-0000-0000-0000-000000000002')",config,license);
        jdbc.update("""
            INSERT INTO private.feature_config_values SELECT ?,id,?::jsonb FROM shop.feature_config_definitions WHERE config_key='ROLE_SHOP_PRODUCTS'
            """,config,"[{\"key\":\"vip\",\"name\":\"VIP\",\"roleId\":\""+ROLE+"\",\"priceSatang\":15000},{\"key\":\"premium\",\"name\":\"Premium\",\"roleId\":\""+OTHER_ROLE+"\",\"priceSatang\":15000}]");
    }
    RoleShopRequests.Begin request(String key) { return new RoleShopRequests.Begin(bot,MEMBER,"vip",ROLE,15000,key); }
    RoleShopPurchase begin(String key) { return tx.execute(s->service.begin(request(key))); }
    long balance() { return jdbc.queryForObject("SELECT balance_satang FROM private.member_wallets WHERE bot_id=? AND member_discord_id=?",Long.class,bot,MEMBER); }
    long entries() { return jdbc.queryForObject("SELECT count(*) FROM private.member_wallet_entries WHERE bot_id=?",Long.class,bot); }

    @Test void shippingMigrationCreatesPrivateCatalogAndRls() {
        assertThat(jdbc.queryForObject("SELECT relrowsecurity FROM pg_class WHERE oid='private.role_shop_purchases'::regclass",Boolean.class)).isTrue();
        assertThat(jdbc.queryForObject("SELECT has_table_privilege('authenticated','private.role_shop_purchases','INSERT')",Boolean.class)).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM shop.feature_presentation_slots",Long.class)).isEqualTo(4);
    }
    @Test void sameRequestDebitsOnceAndConflictingRetriesLeaveLedgerUnchanged() {
        var first=begin("request-001");
        assertThat(begin("request-001").id()).isEqualTo(first.id());
        assertThat(balance()).isEqualTo(5000); assertThat(entries()).isEqualTo(1);
        assertThatThrownBy(()->tx.execute(s->service.begin(new RoleShopRequests.Begin(bot,MEMBER,"vip",ROLE,14999,"request-001"))))
            .isInstanceOf(RoleShopException.class).hasMessageContaining("ไม่ตรง");
        assertThat(entries()).isEqualTo(1);
    }
    @Test void completedPermanentRoleCannotBeBoughtAgainByAnotherConfirmation() {
        var purchase=begin("request-001");
        var claimed=tx.execute(s->service.claim(bot,purchase.id()));
        tx.execute(s->service.complete(bot,purchase.id(),claimed.claimToken()));
        tx.execute(s->service.complete(bot,purchase.id(),claimed.claimToken()));
        assertThatThrownBy(()->begin("request-002")).isInstanceOf(RoleShopException.class);
        assertThat(balance()).isEqualTo(5000); assertThat(entries()).isEqualTo(1);
        assertThatThrownBy(()->tx.execute(s->service.refund(bot,purchase.id(),new RoleShopRequests.Refund(claimed.claimToken(),"failure"))))
            .isInstanceOf(RoleShopException.class);
    }
    @Test void refundIsAtomicIdempotentAndDoesNotCountAsATopup() {
        var purchase=begin("request-001"); var claimed=tx.execute(s->service.claim(bot,purchase.id()));
        var refund=new RoleShopRequests.Refund(claimed.claimToken(),"Missing Permissions");
        tx.execute(s->service.refund(bot,purchase.id(),refund));
        tx.execute(s->service.refund(bot,purchase.id(),refund));
        assertThat(balance()).isEqualTo(20000); assertThat(entries()).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT sum(amount_satang) FROM private.member_wallet_entries WHERE bot_id=?",Long.class,bot)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM private.member_wallet_entries WHERE bot_id=? AND kind='TOPUP'",Long.class,bot)).isZero();
        assertThat(service.recoverable(bot)).isEmpty();
        assertThat(begin("request-002").status()).isEqualTo("DEBITED");
    }
    @Test void staleClaimsRecoverWithANewTokenAndCannotBeSettledByOldWorkers() {
        var purchase=begin("request-001"); var claimed=tx.execute(s->service.claim(bot,purchase.id()));
        assertThatThrownBy(()->tx.execute(s->service.claim(bot,purchase.id()))).isInstanceOf(RoleShopException.class);
        jdbc.update("UPDATE private.role_shop_purchases SET processing_started_at=now()-interval '3 minutes' WHERE id=?",purchase.id());
        assertThat(service.recoverable(bot)).hasSize(1);
        var recovered=tx.execute(s->service.claim(bot,purchase.id()));
        assertThat(recovered.claimToken()).isNotEqualTo(claimed.claimToken());
        assertThatThrownBy(()->tx.execute(s->service.complete(bot,purchase.id(),claimed.claimToken()))).isInstanceOf(RoleShopException.class);
        tx.execute(s->service.complete(bot,purchase.id(),recovered.claimToken()));
        assertThat(service.recoverable(bot)).isEmpty(); assertThat(entries()).isEqualTo(1);
    }
    @Test void currentPriceRoleAndWalletInstallationAreRequiredBeforeCharging() {
        assertThatThrownBy(()->tx.execute(s->service.begin(new RoleShopRequests.Begin(bot,MEMBER,"vip",ROLE,100,"request-001"))))
            .isInstanceOf(RoleShopException.class);
        assertThatThrownBy(()->tx.execute(s->service.begin(new RoleShopRequests.Begin(bot,MEMBER,"vip",OTHER_ROLE,15000,"request-001"))))
            .isInstanceOf(RoleShopException.class);
        jdbc.update("UPDATE private.bot_feature_installations SET status='REMOVED' WHERE bot_id=? AND feature_product_id='e0600000-0000-0000-0000-000000000001'",bot);
        assertThatThrownBy(()->begin("request-001")).isInstanceOf(RoleShopException.class);
        assertThat(balance()).isEqualTo(20000); assertThat(entries()).isZero();
    }
    @Test void concurrentRetryAndConcurrentDifferentProductsCannotOverdrawWallet() throws Exception {
        try (var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->begin("request-001")); var retry=pool.submit(()->begin("request-001"));
            assertThat(first.get().id()).isEqualTo(retry.get().id());
            assertThat(entries()).isEqualTo(1);
        }
        // Seed another bot so both competing products initially see enough money.
        seed();
        try (var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->attempt(request("request-001")));
            var second=pool.submit(()->attempt(new RoleShopRequests.Begin(bot,MEMBER,"premium",OTHER_ROLE,15000,"request-002")));
            assertThat(List.of(first.get(),second.get())).containsExactlyInAnyOrder(true,false);
            assertThat(balance()).isEqualTo(5000); assertThat(entries()).isEqualTo(1);
        }
    }
    @Test void ledgerInsertFailureRollsBackTheBalanceAndPurchase() {
        jdbc.update("""
            INSERT INTO private.member_wallet_entries(bot_id,member_discord_id,kind,amount_satang,balance_after_satang,
              source_reference,idempotency_key,metadata) VALUES (?,?,'ADJUSTMENT',1,20000,'existing','role-shop-debit:request-001','{}')
            """,bot,MEMBER);
        assertThatThrownBy(()->begin("request-001")).isInstanceOf(org.springframework.dao.DataAccessException.class);
        assertThat(balance()).isEqualTo(20000); assertThat(entries()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM private.role_shop_purchases WHERE bot_id=?",Long.class,bot)).isZero();
    }
    @Test void anotherBotCannotClaimCompleteRefundOrRecoverThePurchase() {
        var purchase=begin("request-001"); var claimed=tx.execute(s->service.claim(bot,purchase.id()));
        UUID other=UUID.randomUUID();
        assertThatThrownBy(()->tx.execute(s->service.claim(other,purchase.id()))).isInstanceOf(RoleShopException.class);
        assertThatThrownBy(()->tx.execute(s->service.complete(other,purchase.id(),claimed.claimToken()))).isInstanceOf(RoleShopException.class);
        assertThatThrownBy(()->tx.execute(s->service.refund(other,purchase.id(),new RoleShopRequests.Refund(claimed.claimToken(),"failure"))))
            .isInstanceOf(RoleShopException.class);
        assertThat(service.recoverable(other)).isEmpty(); assertThat(balance()).isEqualTo(5000); assertThat(entries()).isEqualTo(1);
    }
    boolean attempt(RoleShopRequests.Begin request) {
        try { tx.execute(s->service.begin(request)); return true; } catch (RoleShopException error) { return false; }
    }
}
