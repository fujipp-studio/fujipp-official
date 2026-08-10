import { Pool } from "pg";
import { connect } from "node:net";
import type { MemberSpendingEntry, MemberSpendingStore } from "../../types.js";
import { resolvePublicPostgresUrl } from "../../network-security.js";

export async function createOwnDatabaseStore(url:string,subjectId:string):Promise<MemberSpendingStore & {close():Promise<void>}> {
  const {url:safeUrl,addresses}=await resolvePublicPostgresUrl(url);
  const connectionString=safeUrl.toString();
  let nextAddress=0;
  const port=Number(safeUrl.port||5432);
  const pool=new Pool({connectionString,max:2,connectionTimeoutMillis:10_000,idleTimeoutMillis:30_000,query_timeout:15_000,statement_timeout:15_000,ssl:needsSsl(connectionString)?{rejectUnauthorized:true}:undefined,
    stream:()=>connect({host:addresses[nextAddress++%addresses.length]!,port})});
  pool.on("error",(error)=>console.error(`Member Spending external database pool error: ${error.message}`));
  await pool.query("CREATE SCHEMA IF NOT EXISTS shop");
  await pool.query(`CREATE TABLE IF NOT EXISTS shop.member_spending(
    external_subject_id TEXT NOT NULL,member_discord_id TEXT NOT NULL,
    amount_satang BIGINT NOT NULL DEFAULT 0 CHECK(amount_satang>=0),
    tx_count INTEGER NOT NULL DEFAULT 0 CHECK(tx_count>=0),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(external_subject_id,member_discord_id))`);
  const entry=(row:Record<string,unknown>):MemberSpendingEntry=>({memberDiscordId:String(row.member_discord_id),amountSatang:Number(row.amount_satang),txCount:Number(row.tx_count)});
  return {
    async add(memberDiscordId,deltaSatang){const r=await pool.query(`INSERT INTO shop.member_spending VALUES($1,$2,$3,1,now()) ON CONFLICT(external_subject_id,member_discord_id) DO UPDATE SET amount_satang=shop.member_spending.amount_satang+$3,tx_count=shop.member_spending.tx_count+1,updated_at=now() RETURNING member_discord_id,amount_satang,tx_count`,[subjectId,memberDiscordId,deltaSatang]);return entry(r.rows[0]);},
    async set(memberDiscordId,input){const amount=input.amountSatang??null,count=input.txCount??null;const r=await pool.query(`INSERT INTO shop.member_spending VALUES($1,$2,COALESCE($3,0),COALESCE($4,0),now()) ON CONFLICT(external_subject_id,member_discord_id) DO UPDATE SET amount_satang=COALESCE($3,shop.member_spending.amount_satang),tx_count=COALESCE($4,shop.member_spending.tx_count),updated_at=now() RETURNING member_discord_id,amount_satang,tx_count`,[subjectId,memberDiscordId,amount,count]);return entry(r.rows[0]);},
    async get(memberDiscordId){const r=await pool.query("SELECT member_discord_id,amount_satang,tx_count FROM shop.member_spending WHERE external_subject_id=$1 AND member_discord_id=$2",[subjectId,memberDiscordId]);return r.rows[0]?entry(r.rows[0]):null;},
    async remove(memberDiscordId){return (await pool.query("DELETE FROM shop.member_spending WHERE external_subject_id=$1 AND member_discord_id=$2",[subjectId,memberDiscordId])).rowCount!==0;},
    async leaderboard(limit){const r=await pool.query("SELECT member_discord_id,amount_satang,tx_count FROM shop.member_spending WHERE external_subject_id=$1 ORDER BY amount_satang DESC,tx_count DESC,member_discord_id LIMIT $2",[subjectId,Math.max(1,Math.min(limit,1000))]);return r.rows.map(entry);},
    async totals(){const r=await pool.query("SELECT COALESCE(sum(amount_satang),0) amount,COALESCE(sum(tx_count),0) count FROM shop.member_spending WHERE external_subject_id=$1",[subjectId]);return{amountSatang:Number(r.rows[0].amount),txCount:Number(r.rows[0].count)};},
    async close(){await pool.end();},
  };
}
function needsSsl(url:string){return /sslmode=require|neon\.tech|supabase\.(co|com)/i.test(url);}
