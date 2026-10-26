import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { createPostgresSpendingStore, initializeSpendingTables } from "../src/features/member-spending/store.js";

// The same contract can run against a disposable PostgreSQL database or an embedded PG test harness.
export async function verifySpendingStore(pool: Pool): Promise<void> {
  await initializeSpendingTables(pool);
  const subject = `test-${randomUUID()}`, member = "222222222222222222", other = "333333333333333333";
  const store = createPostgresSpendingStore(pool, subject);
  const otherStore = createPostgresSpendingStore(pool, `other-${subject}`);
  const { rows: [date] } = await pool.query("SELECT to_char(now() AT TIME ZONE 'Asia/Bangkok','YYYY-MM') AS month");
  const month: string = date.month;
  try {
    // A pre-existing balance has no transaction dates and must not be backfilled into this month.
    await store.set(member, { amountSatang: 30000000000, txCount: 4 }, "large-opening");
    assert.equal((await store.get(member))!.amountSatang, 30000000000);
    await store.set(member, { amountSatang: 50000, txCount: 4 }, "opening");
    assert.equal((await store.get(member))!.thisMonthSatang, 0);
    assert.deepEqual(await store.leaderboard(5, month), []);
    const first = await store.add(member, 10000, "add-1");
    assert.deepEqual(first, { memberDiscordId: member, amountSatang: 60000, txCount: 5, thisMonthSatang: 10000, thisMonthTxCount: 1 });
    assert.deepEqual(await store.add(member, 10000, "add-1"), first);
    await assert.rejects(store.add(member, 20000, "add-1"), /different spending operation/);
    await assert.rejects(store.add(other, 10000, "add-1"), /different spending operation/);
    await Promise.all(Array.from({ length: 8 }, (_, index) => store.add(member, 100, `concurrent-${index}`)));
    const after = (await store.get(member))!;
    assert.equal(after.amountSatang, 60800); assert.equal(after.thisMonthSatang, 10800);
    assert.equal(after.txCount, 13); assert.equal(after.thisMonthTxCount, 9);
    await store.add(other, 20000, "other-add");
    assert.equal((await store.leaderboard(5))[0]!.memberDiscordId, member);
    assert.equal((await store.leaderboard(5, month))[0]!.memberDiscordId, other);
    await otherStore.add(member, 999999, "add-1");
    assert.equal((await store.get(member))!.amountSatang, 60800);

    // Moving a prior month's fixture out of the current bucket simulates rollover without deleting history.
    await pool.query("UPDATE shop.member_spending_monthly SET month='2020-01-01' WHERE external_subject_id=$1 AND member_discord_id=$2", [subject, member]);
    assert.equal((await store.get(member))!.thisMonthSatang, 0);
    assert.equal((await store.get(member, "2020-01"))!.amountSatang, 10800);
    assert.equal((await store.get(member))!.amountSatang, 60800);
    await store.add(member, 2500, "next-month");
    assert.equal((await store.get(member))!.thisMonthSatang, 2500);
    assert.equal((await store.get(member, "2020-01"))!.amountSatang, 10800);
    assert.deepEqual(await store.totals(month), { amountSatang: 22500, txCount: 2 });
    assert.deepEqual(await store.totals("2020-01"), { amountSatang: 10800, txCount: 9 });
    assert.deepEqual(await store.totals("2020-02"), { amountSatang: 0, txCount: 0 });
    await assert.rejects(store.leaderboard(5, "2026-13"), /YYYY-MM/);
    await assert.rejects(store.leaderboard(5, "0000-01"), /YYYY-MM/);
    await assert.rejects(store.get(member, "2026-01' OR true --"), /YYYY-MM/);

    // Corrections affect lifetime balances only and record compensating ledger deltas.
    await store.set(member, { amountSatang: 62000 }, "correction");
    assert.equal((await store.get(member))!.thisMonthSatang, 2500);
    await store.set(member, { amountSatang: 62000 }, "correction");
    const { rows: [ledger] } = await pool.query("SELECT sum(amount_delta)::text amount FROM shop.member_spending_operations WHERE external_subject_id=$1 AND member_discord_id=$2", [subject, member]);
    assert.equal(ledger.amount, "62000");
    assert.equal(await store.remove(member, "delete"), true);
    assert.equal(await store.get(member), null);
    assert.equal((await store.leaderboard(5, "2020-01")).length, 0);
    assert.equal(await store.remove(member, "delete"), false);
    const { rows: [deleted] } = await pool.query("SELECT sum(amount_delta)::text amount FROM shop.member_spending_operations WHERE external_subject_id=$1 AND member_discord_id=$2", [subject, member]);
    assert.equal(deleted.amount, "0");

    // A failure after updating the lifetime row rolls back both the balance and operation key.
    const failingPool = {
      connect: async () => {
        const client = await pool.connect();
        return {
          query: (sql: string, values?: unknown[]) => sql.includes("INSERT INTO shop.member_spending_monthly")
            ? Promise.reject(new Error("monthly write failed")) : client.query(sql, values),
          release: () => client.release(),
        };
      },
    } as unknown as Pool;
    await assert.rejects(createPostgresSpendingStore(failingPool, subject).add(member, 100, "retry-after-failure"), /monthly write failed/);
    assert.equal(await store.get(member), null);
    await store.add(member, 100, "retry-after-failure");
    assert.equal((await store.get(member))!.amountSatang, 100);
    assert.equal((await store.get(member))!.thisMonthSatang, 100);
  } finally {
    for (const id of [subject, `other-${subject}`]) {
      await pool.query("DELETE FROM shop.member_spending WHERE external_subject_id=$1", [id]);
      await pool.query("DELETE FROM shop.member_spending_operations WHERE external_subject_id=$1", [id]);
    }
  }
}

test("PostgreSQL spending: monthly history, lifetime totals, isolation, retries, corrections, and rollback", {
  skip: !process.env.SPENDING_TEST_DB_URL,
}, async () => {
  const pool = new Pool({ connectionString: process.env.SPENDING_TEST_DB_URL, max: 4 });
  try { await verifySpendingStore(pool); } finally { await pool.end(); }
});
