package com.fujipp.backend.spending;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.Executors;
import static org.assertj.core.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "SPENDING_PLATFORM_TEST_DB_URL", matches = ".+")
class MemberSpendingPostgresTests {
    private static DriverManagerDataSource dataSource;
    private static JdbcTemplate jdbc;
    private static TransactionTemplate transactions;
    private static MemberSpendingRepository repository;
    private static final String MEMBER = "222222222222222222";
    private static final LocalDate OCTOBER = LocalDate.of(2026, 10, 1);
    private static final LocalDate NOVEMBER = LocalDate.of(2026, 11, 1);
    private UUID bot;

    @BeforeAll static void initializeDisposableDatabase() {
        dataSource = new DriverManagerDataSource(System.getenv("SPENDING_PLATFORM_TEST_DB_URL"),
                System.getenv("SPENDING_PLATFORM_TEST_DB_USER"), System.getenv("SPENDING_PLATFORM_TEST_DB_PASSWORD"));
        jdbc = new JdbcTemplate(dataSource);
        // Never provision or clear tables in an application database.
        assertThat(jdbc.queryForObject("SELECT current_database()", String.class)).startsWith("spending_correction_test_");
        jdbc.execute("""
            CREATE SCHEMA private;
            CREATE TABLE private.member_spending (
              bot_id UUID NOT NULL, member_discord_id TEXT NOT NULL,
              amount_satang BIGINT NOT NULL CHECK(amount_satang>=0), tx_count INTEGER NOT NULL CHECK(tx_count>=0),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(bot_id,member_discord_id));
            CREATE TABLE private.member_spending_monthly (
              bot_id UUID NOT NULL, member_discord_id TEXT NOT NULL, month DATE NOT NULL,
              amount_satang BIGINT NOT NULL CHECK(amount_satang>=0), tx_count INTEGER NOT NULL CHECK(tx_count>=0),
              PRIMARY KEY(bot_id,member_discord_id,month),
              FOREIGN KEY(bot_id,member_discord_id) REFERENCES private.member_spending ON DELETE CASCADE);
            CREATE TABLE private.member_spending_operations (
              bot_id UUID NOT NULL, operation_key TEXT NOT NULL, member_discord_id TEXT NOT NULL,
              operation TEXT NOT NULL, requested_amount BIGINT, requested_count INTEGER,
              amount_delta BIGINT NOT NULL, count_delta INTEGER NOT NULL, PRIMARY KEY(bot_id,operation_key));
            """);
        transactions = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        repository = new MemberSpendingRepository(jdbc);
    }

    @BeforeEach void seedUndatedOpeningBalance() {
        bot = UUID.randomUUID();
        set(100000L, 10, "opening", null);
    }

    private MemberSpendingRepository.Entry set(Long amount, Integer count, String key, LocalDate period) {
        return transactions.execute(status -> repository.set(bot, MEMBER, amount, count, key, period));
    }

    @Test void correctionsAdjustCurrentMonthByLifetimeDifferencesAndRecordTheLedger() {
        var first = set(110000L, 12, "increase", OCTOBER);
        assertThat(first.thisMonthSatang()).isEqualTo(10000);
        assertThat(first.thisMonthTxCount()).isEqualTo(2);
        set(105000L, null, "decrease", OCTOBER);
        var after = set(null, 11, "count", OCTOBER);
        assertThat(after).isEqualTo(new MemberSpendingRepository.Entry(MEMBER, 105000, 11, 5000, 1));
        assertThat(jdbc.queryForObject("SELECT sum(amount_delta) FROM private.member_spending_operations WHERE bot_id=?", Long.class, bot)).isEqualTo(105000);
        assertThat(jdbc.queryForObject("SELECT sum(count_delta) FROM private.member_spending_operations WHERE bot_id=?", Long.class, bot)).isEqualTo(11);
    }

    @Test void negativeMonthlyAmountOrCountRejectsTheWholeCorrectionAndLedger() {
        var before = set(110000L, 12, "increase", OCTOBER);
        assertThatThrownBy(() -> set(90000L, null, "negative-amount", OCTOBER)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("รอบเดือนปัจจุบันติดลบ");
        assertThatThrownBy(() -> set(120000L, 9, "negative-count", OCTOBER)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("รอบเดือนปัจจุบันติดลบ");
        assertThat(repository.get(bot, MEMBER, null, OCTOBER)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM private.member_spending_operations WHERE bot_id=? AND operation_key LIKE 'negative-%'", Long.class, bot)).isZero();
        assertThat(set(100000L, 10, "zero", OCTOBER).thisMonthSatang()).isZero();
    }

    @Test void retriesAfterOtherCorrectionsAndRolloverNeverMoveHistoricSpending() {
        set(110000L, 12, "increase", OCTOBER);
        set(105000L, 11, "decrease", OCTOBER);
        var next = set(115000L, 13, "next-cycle", NOVEMBER);
        assertThat(set(110000L, 12, "increase", NOVEMBER)).isEqualTo(next);
        assertThat(next.thisMonthSatang()).isEqualTo(10000);
        assertThat(next.thisMonthTxCount()).isEqualTo(2);
        assertThat(repository.get(bot, MEMBER, OCTOBER, NOVEMBER).amountSatang()).isEqualTo(5000);
        assertThatThrownBy(() -> set(110001L, 12, "increase", NOVEMBER)).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("different spending operation");
    }

    @Test void disabledTrackingAndRetriesAfterReenablingKeepExistingMonthlyHistory() {
        set(110000L, 12, "increase", OCTOBER);
        set(120000L, 14, "disabled", null);
        var after = set(120000L, 14, "disabled", OCTOBER);
        assertThat(after.amountSatang()).isEqualTo(120000);
        assertThat(after.thisMonthSatang()).isEqualTo(10000);
        assertThat(after.thisMonthTxCount()).isEqualTo(2);
    }

    @Test void monthlyWriteFailureRollsBackTheLifetimeWriteAndAllowsAnIdempotentRetry() {
        var before = set(110000L, 12, "increase", OCTOBER);
        var failing = new MemberSpendingRepository(new JdbcTemplate(dataSource) {
            @Override public int update(String sql, Object... args) {
                if (sql.contains("INSERT INTO private.member_spending_monthly")) throw new DataAccessResourceFailureException("monthly correction failed");
                return super.update(sql, args);
            }
        });
        assertThatThrownBy(() -> transactions.execute(status -> failing.set(bot, MEMBER, 120000L, null, "retry", OCTOBER))).isInstanceOf(DataAccessResourceFailureException.class);
        assertThat(repository.get(bot, MEMBER, null, OCTOBER)).isEqualTo(before);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM private.member_spending_operations WHERE bot_id=? AND operation_key='retry'", Long.class, bot)).isZero();
        assertThat(set(120000L, null, "retry", OCTOBER).thisMonthSatang()).isEqualTo(20000);
    }

    @Test void concurrentCorrectionsSerializeLifetimeAndMonthlyBalancesTogether() throws Exception {
        set(110000L, 12, "increase", OCTOBER);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> set(120000L, null, "concurrent-1", OCTOBER));
            var second = executor.submit(() -> set(125000L, null, "concurrent-2", OCTOBER));
            first.get(); second.get();
        }
        var after = repository.get(bot, MEMBER, null, OCTOBER);
        assertThat(after.thisMonthSatang()).isEqualTo(after.amountSatang() - 100000);
        assertThat(after.thisMonthTxCount()).isEqualTo(2);
    }
}
