import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { MemberSpendingEntry, MemberSpendingStore, MemberSpendingMonthlySettings } from "../../types.js";
import { resolvePublicPostgresUrl } from "../../network-security.js";
import { createPostgresSocket, postgresConnectionError } from "./postgres-connection.js";
import { spendingMonth } from "./period.js";

const legacyMonthlySettings: MemberSpendingMonthlySettings = { enabled: true, startDay: 1 };

export async function createOwnDatabaseStore(url: string, subjectId: string, settings: MemberSpendingMonthlySettings = legacyMonthlySettings): Promise<MemberSpendingStore & { close(): Promise<void> }> {
  const { url: safeUrl, addresses } = await resolvePublicPostgresUrl(url);
  const connectionString = safeUrl.toString();
  const pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000,
    query_timeout: 15_000, statement_timeout: 15_000, ssl: needsSsl(connectionString) ? { rejectUnauthorized: true } : undefined,
    stream: () => createPostgresSocket(safeUrl, addresses) });
  pool.on("error", error => console.error(`Member Spending external database pool error: ${error.message}`));
  try {
    await initializeSpendingTables(pool);
    const store = createPostgresSpendingStore(pool, subjectId, settings);
    // Preserve connection diagnostics for both reads and writes without exposing credentials.
    const wrap = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A): Promise<R> => {
      try { return await fn(...args); } catch (error) { throw postgresConnectionError(error, addresses); }
    };
    return { add: wrap(store.add), set: wrap(store.set), get: wrap(store.get), remove: wrap(store.remove),
      leaderboard: wrap(store.leaderboard), totals: wrap(store.totals), close: async () => { await pool.end(); } };
  } catch (error) { await pool.end(); throw postgresConnectionError(error, addresses); }
}

export async function initializeSpendingTables(pool: Pool): Promise<void> {
  await pool.query("CREATE SCHEMA IF NOT EXISTS shop");
  await pool.query(`CREATE TABLE IF NOT EXISTS shop.member_spending(
    external_subject_id TEXT NOT NULL, member_discord_id TEXT NOT NULL,
    amount_satang BIGINT NOT NULL DEFAULT 0 CHECK(amount_satang>=0),
    tx_count INTEGER NOT NULL DEFAULT 0 CHECK(tx_count>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(external_subject_id,member_discord_id))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS shop.member_spending_monthly(
    external_subject_id TEXT NOT NULL, member_discord_id TEXT NOT NULL,
    month DATE NOT NULL CHECK(EXTRACT(DAY FROM month)=1),
    amount_satang BIGINT NOT NULL DEFAULT 0 CHECK(amount_satang>=0),
    tx_count INTEGER NOT NULL DEFAULT 0 CHECK(tx_count>=0),
    PRIMARY KEY(external_subject_id,member_discord_id,month),
    FOREIGN KEY(external_subject_id,member_discord_id) REFERENCES shop.member_spending ON DELETE CASCADE)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS member_spending_monthly_rank_idx
    ON shop.member_spending_monthly(external_subject_id,month,amount_satang DESC,tx_count DESC,member_discord_id)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS shop.member_spending_operations(
    external_subject_id TEXT NOT NULL, operation_key TEXT NOT NULL, member_discord_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK(operation IN ('ADD','SET','DELETE')), requested_amount BIGINT, requested_count INTEGER,
    amount_delta BIGINT NOT NULL, count_delta INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(external_subject_id,operation_key))`);
  for (const table of ["member_spending", "member_spending_monthly", "member_spending_operations"]) {
    await pool.query(`ALTER TABLE shop.${table} ENABLE ROW LEVEL SECURITY`);
    await pool.query(`REVOKE ALL ON shop.${table} FROM PUBLIC`);
    // Supabase exposes shop through its Data API. The connection owner retains access.
    await pool.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON shop.${table} FROM anon; END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON shop.${table} FROM authenticated; END IF;
    END $$`);
  }
}

export function createPostgresSpendingStore(pool: Pool, subjectId: string, settings: MemberSpendingMonthlySettings = legacyMonthlySettings, now: () => Date = () => new Date()): MemberSpendingStore {
  const currentMonth = () => settings.enabled ? `DATE '${spendingMonth(now(), settings.startDay)}-01'` : "NULL::date";
  const entry = (row: Record<string, unknown>): MemberSpendingEntry => ({ memberDiscordId: String(row.member_discord_id),
    amountSatang: Number(row.amount_satang), txCount: Number(row.tx_count),
    thisMonthSatang: Number(row.this_month_satang), thisMonthTxCount: Number(row.this_month_count) });
  const select = (month?: string, period = currentMonth()) => {
    if (month && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("ระบุเดือนในรูปแบบ YYYY-MM");
    return `SELECT s.member_discord_id,${month ? "COALESCE(p.amount_satang,0) amount_satang,COALESCE(p.tx_count,0) tx_count" : "s.amount_satang,s.tx_count"},
      COALESCE(c.amount_satang,0) this_month_satang,COALESCE(c.tx_count,0) this_month_count
      FROM shop.member_spending s LEFT JOIN shop.member_spending_monthly c
      ON c.external_subject_id=s.external_subject_id AND c.member_discord_id=s.member_discord_id AND c.month=${period}
      ${month ? `LEFT JOIN shop.member_spending_monthly p ON p.external_subject_id=s.external_subject_id
        AND p.member_discord_id=s.member_discord_id AND p.month=DATE '${month}-01'` : ""}`;
  };
  const get = async (db: Pool | PoolClient, memberId: string, month?: string, period = currentMonth()) => {
    const result = await db.query(`${select(month, period)} WHERE s.external_subject_id=$1 AND s.member_discord_id=$2`, [subjectId, memberId]);
    return result.rows[0] ? entry(result.rows[0]) : null;
  };
  const transact = async <T>(memberId: string, action: (db: PoolClient, period: string) => Promise<T>): Promise<T> => {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2,0))", [subjectId, memberId]);
      await db.query("SELECT member_discord_id FROM shop.member_spending WHERE external_subject_id=$1 AND member_discord_id=$2 FOR UPDATE", [subjectId, memberId]);
      const result = await action(db, currentMonth());
      await db.query("COMMIT");
      return result;
    } catch (error) { await db.query("ROLLBACK").catch(() => {}); throw error; }
    finally { db.release(); }
  };
  const record = async (db: PoolClient, memberId: string, operation: string, key: string, amount: number | null, count: number | null, delta: number, countDelta: number) => {
    const existing = await db.query("SELECT member_discord_id,operation,requested_amount,requested_count FROM shop.member_spending_operations WHERE external_subject_id=$1 AND operation_key=$2", [subjectId, key]);
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.member_discord_id !== memberId || row.operation !== operation || (row.requested_amount === null ? null : Number(row.requested_amount)) !== amount || row.requested_count !== count)
        throw new Error("Operation key already used for a different spending operation");
      return false;
    }
    await db.query(`INSERT INTO shop.member_spending_operations(external_subject_id,operation_key,member_discord_id,operation,requested_amount,requested_count,amount_delta,count_delta)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [subjectId, key, memberId, operation, amount, count, delta, countDelta]);
    return true;
  };
  return {
    add: (memberId, delta, key = randomUUID()) => transact(memberId, async (db, period) => {
      if (!Number.isSafeInteger(delta) || delta <= 0) throw new Error("ยอดเพิ่มไม่ถูกต้อง");
      if (await record(db, memberId, "ADD", key, delta, null, delta, 1)) {
        await db.query(`INSERT INTO shop.member_spending(external_subject_id,member_discord_id,amount_satang,tx_count)
          VALUES($1,$2,$3,1) ON CONFLICT(external_subject_id,member_discord_id) DO UPDATE SET
          amount_satang=shop.member_spending.amount_satang+$3,tx_count=shop.member_spending.tx_count+1,updated_at=now()`, [subjectId, memberId, delta]);
        if (settings.enabled) await db.query(`INSERT INTO shop.member_spending_monthly(external_subject_id,member_discord_id,month,amount_satang,tx_count)
          VALUES($1,$2,${period},$3,1) ON CONFLICT(external_subject_id,member_discord_id,month) DO UPDATE SET
          amount_satang=shop.member_spending_monthly.amount_satang+$3,tx_count=shop.member_spending_monthly.tx_count+1`, [subjectId, memberId, delta]);
      }
      return (await get(db, memberId, undefined, period))!;
    }),
    set: (memberId, input, key = randomUUID()) => transact(memberId, async (db, period) => {
      for (const value of [input.amountSatang, input.txCount]) if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) throw new Error("ยอดหรือจำนวนครั้งไม่ถูกต้อง");
      const before = await get(db, memberId, undefined, period);
      const amount = input.amountSatang ?? null, count = input.txCount ?? null;
      if (await record(db, memberId, "SET", key, amount, count, amount === null ? 0 : amount - (before?.amountSatang ?? 0), count === null ? 0 : count - (before?.txCount ?? 0))) {
        await db.query(`INSERT INTO shop.member_spending(external_subject_id,member_discord_id,amount_satang,tx_count)
          VALUES($1,$2,COALESCE($3::bigint,0),COALESCE($4::integer,0)) ON CONFLICT(external_subject_id,member_discord_id) DO UPDATE SET
          amount_satang=COALESCE($3,shop.member_spending.amount_satang),tx_count=COALESCE($4,shop.member_spending.tx_count),updated_at=now()`, [subjectId, memberId, amount, count]);
      }
      return (await get(db, memberId, undefined, period))!;
    }),
    get: (memberId, month) => get(pool, memberId, month),
    remove: (memberId, key = randomUUID()) => transact(memberId, async (db, period) => {
      const before = await get(db, memberId, undefined, period);
      if (!await record(db, memberId, "DELETE", key, null, null, -(before?.amountSatang ?? 0), -(before?.txCount ?? 0))) return false;
      return (await db.query("DELETE FROM shop.member_spending WHERE external_subject_id=$1 AND member_discord_id=$2", [subjectId, memberId])).rowCount !== 0;
    }),
    async leaderboard(limit, month) {
      const result = await pool.query(`${select(month)} WHERE s.external_subject_id=$1 ${month ? "AND p.amount_satang>0" : ""}
        ORDER BY amount_satang DESC,tx_count DESC,s.member_discord_id LIMIT $2`, [subjectId, Math.max(1, Math.min(limit, 1000))]);
      return result.rows.map(entry);
    },
    async totals(month) {
      select(month); // Validate before constructing a date or querying storage.
      const result = await pool.query(`SELECT COALESCE(sum(amount_satang),0) amount,COALESCE(sum(tx_count),0) count
        FROM shop.${month ? "member_spending_monthly" : "member_spending"} WHERE external_subject_id=$1 ${month ? "AND month=$2::date" : ""}`, month ? [subjectId, `${month}-01`] : [subjectId]);
      return { amountSatang: Number(result.rows[0].amount), txCount: Number(result.rows[0].count) };
    },
  };
}
function needsSsl(url: string) { return /sslmode=require|neon\.tech|supabase\.(co|com)/i.test(url); }
