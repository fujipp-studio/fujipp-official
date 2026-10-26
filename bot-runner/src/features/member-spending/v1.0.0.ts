import {ActionRowBuilder,EmbedBuilder,MessageFlags,ModalBuilder,PermissionFlagsBits,SlashCommandBuilder,TextInputBuilder,TextInputStyle,type ChatInputCommandInteraction,type GuildMember,type Interaction,type ModalSubmitInteraction,type SlashCommandSubcommandBuilder} from "discord.js";
import type {FeatureContext,FeatureModule,MemberSpendingEntry,MemberSpendingStore} from "../../types.js";
import {createOwnDatabaseStore} from "./store.js";

export function spendingMonth(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
}

export function createMemberSpendingFeature(createExternalStore:typeof createOwnDatabaseStore=createOwnDatabaseStore):FeatureModule {
  return { runtimeKey:"member-spending",version:"1.0.0",intents:["Guilds","GuildMembers"],async activate(context) {
    const own=bool(context.config.SPENDING_DB_USE_OWN,false);
    const external=own?lazyExternalStore(requiredSecret(context.secrets.SPENDING_DB_URL),context.botId,createExternalStore):undefined;
    const store=external??context.memberSpending;
    let stopped=false, syncing=false;
    const onInteraction=(i:Interaction)=>{
      const task=i.isChatInputCommand()&&i.commandName==="spending"?command(context,store,i):i.isModalSubmit()&&i.customId.startsWith("spending:update:")?update(context,store,i):null;
      if(task)void task.catch(e=>respondError(i,e));
    };
    const refresh=async()=>{
      if(stopped||syncing||!context.guildId||!monthlyRolesEnabled(context))return;
      syncing=true;
      try { const guild=await context.client.guilds.fetch(context.guildId);if(!stopped)await syncMonthlyRoles(context,store,guild,undefined,()=>!stopped); }
      catch(error){console.error("Member Spending monthly role sync failed",error);}
      finally{syncing=false;}
    };
    const onReady=()=>{
      if(stopped)return;
      void register(context).catch(e=>{console.error("Member Spending command registration failed",e);void context.reportFeatureError("COMMAND_REGISTRATION_FAILED",e);});
      void refresh();
    };
    context.client.on("interactionCreate",onInteraction);
    context.client.once("clientReady",onReady);
    const timer=monthlyRolesEnabled(context)?setInterval(()=>{void refresh();},60_000):undefined;
    timer?.unref();
    if(context.client.isReady?.())onReady();
    return async()=>{stopped=true;if(timer)clearInterval(timer);context.client.off("interactionCreate",onInteraction);context.client.off("clientReady",onReady);await external?.close();};
  }};
}
export const memberSpendingFeature=createMemberSpendingFeature();

function lazyExternalStore(url:string,botId:string,create:typeof createOwnDatabaseStore):Awaited<ReturnType<typeof createOwnDatabaseStore>> {
  let connection:ReturnType<typeof createOwnDatabaseStore>|undefined;
  let stopped=false;
  const get=async()=>{
    if(stopped)throw new Error("Member Spending has stopped");
    const store=await(connection??=create(url,botId).catch(error=>{connection=undefined;throw error;}));
    if(stopped)throw new Error("Member Spending has stopped");
    return store;
  };
  return {
    async add(id,amount,key){return(await get()).add(id,amount,key);},
    async set(id,input,key){return(await get()).set(id,input,key);},
    async get(id,month){return(await get()).get(id,month);},
    async remove(id,key){return(await get()).remove(id,key);},
    async leaderboard(limit,month){return(await get()).leaderboard(limit,month);},
    async totals(month){return(await get()).totals(month);},
    async close(){stopped=true;const store=await connection?.catch(()=>undefined);await store?.close();},
  };
}

function selectedMonth(i:ChatInputCommandInteraction):string|undefined {
  const month=i.options.getString?.("month")??undefined;
  if(month&&!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error("ระบุเดือนในรูปแบบ YYYY-MM เช่น 2026-10");
  return month??(i.options.getString?.("period")==="this_month"?spendingMonth():undefined);
}
async function command(c:FeatureContext,s:MemberSpendingStore,i:ChatInputCommandInteraction) {
  if(!i.inGuild())return;
  const sub=i.options.getSubcommand();
  if(!c.permissions.canUse(i,`spending/${sub}`,i.memberPermissions?.has(PermissionFlagsBits.Administrator)===true))return i.reply({content:"คุณไม่มีสิทธิ์ใช้คำสั่งนี้",flags:MessageFlags.Ephemeral});
  const guild=i.guild!;
  if(sub==="add") {
    const user=i.options.getUser("member",true),baht=i.options.getInteger("amount",true);
    await i.deferReply({flags:MessageFlags.Ephemeral});
    const e=await s.add(user.id,baht*100,i.id),member=await guild.members.fetch(user.id).catch(()=>null);
    if(member)await applyRoles(c,member,e.amountSatang,e.txCount);
    const monthlySynced=await syncMonthlyRolesAfterWrite(c,s,guild);
    const payload=render(c,e.txCount===1?"first_card":"returning_card",vars(user.id,member?.displayName??user.username,baht*100,e,member?.displayAvatarURL({extension:"png",size:256})??user.displayAvatarURL({extension:"png",size:256})));
    if(i.channel?.isTextBased()&&"send" in i.channel)await i.channel.send(payload as never);
    await i.editReply(`อัปเดตบัตรสะสมเรียบร้อย${monthlySynced?"":" (อัปเดตยศประจำเดือนไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ)"}`);return;
  }
  if(sub==="update") {
    const user=i.options.getUser("member",true);
    await i.showModal(new ModalBuilder().setCustomId(`spending:update:${user.id}`).setTitle("แก้ไขยอดรวมทั้งหมด").addComponents(row("amount","ยอดรวม (บาท) เว้นว่าง=ไม่เปลี่ยน",false),row("count","จำนวนครั้ง เว้นว่าง=ไม่เปลี่ยน",false)));return;
  }
  const user=i.options.getUser("member")??i.user;
  await i.deferReply(sub==="delete"||sub==="check"||sub==="total"?{flags:MessageFlags.Ephemeral}:{});
  if(sub==="delete") {
    const removed=await s.remove(user.id,i.id),monthlySynced=await syncMonthlyRolesAfterWrite(c,s,guild);
    await i.editReply({content:(removed?`ลบข้อมูล <@${user.id}> รวมทุกเดือนแล้ว`:"ไม่พบข้อมูลสมาชิก")+(monthlySynced?"":" (อัปเดตยศประจำเดือนไม่สำเร็จ ระบบจะลองใหม่อัตโนมัติ)")});return;
  }
  const month=selectedMonth(i);
  if(sub==="check") {
    const e=await s.get(user.id)??{memberDiscordId:user.id,amountSatang:0,txCount:0};
    const history=month&&month!==spendingMonth()?await s.get(user.id,month):undefined;
    await i.editReply({embeds:[new EmbedBuilder().setTitle("บัตรสะสม").setDescription(`<@${user.id}>\nยอดสะสมทั้งหมด **${money(e.amountSatang)} บาท** · ${e.txCount} ครั้ง\nเดือนนี้ (${spendingMonth()}) **${money(e.thisMonthSatang??0)} บาท** · ${e.thisMonthTxCount??0} ครั้ง${history?`\nเดือน ${month} **${money(history.amountSatang)} บาท** · ${history.txCount} ครั้ง`:""}`)]});return;
  }
  if(sub==="total") {
    const e=await s.totals(month);await i.editReply({content:`ยอดรวม${month?`เดือน ${month}`:"ทั้งหมด"} ${money(e.amountSatang)} บาท · ${e.txCount} ครั้ง`});return;
  }
  const board=await s.leaderboard(sub==="rank"?5:20,month);
  if(!month)await syncRankRoles(c,guild,board);
  // Historical browsing never awards roles for a previous month.
  if(month===spendingMonth())await syncMonthlyRoles(c,s,guild,board);
  const lines=board.map((e,n)=>`${n+1}. <@${e.memberDiscordId}> — ${money(e.amountSatang)} บาท · ${e.txCount} ครั้ง`).join("\n")||"ยังไม่มีข้อมูล";
  await i.editReply(render(c,month?"monthly_leaderboard":"leaderboard",{leaderboard_lines:lines,member_count:String(board.length),month:month??""}) as never);
}
async function update(c:FeatureContext,s:MemberSpendingStore,i:ModalSubmitInteraction) {
  if(!i.inGuild()||!i.memberPermissions?.has(PermissionFlagsBits.Administrator))return i.reply({content:"ไม่มีสิทธิ์",flags:MessageFlags.Ephemeral});
  const id=i.customId.slice("spending:update:".length),amount=parseOptional(i.fields.getTextInputValue("amount"),100),count=parseOptional(i.fields.getTextInputValue("count"),1);
  if(amount===undefined&&count===undefined)return i.reply({content:"กรุณากรอกอย่างน้อยหนึ่งช่อง",flags:MessageFlags.Ephemeral});
  await i.deferReply({flags:MessageFlags.Ephemeral});
  const e=await s.set(id,{...(amount!==undefined?{amountSatang:amount}:{}),...(count!==undefined?{txCount:count}:{})},i.id);
  await i.editReply({content:`ตั้งยอดรวมทั้งหมด <@${id}> เป็น ${money(e.amountSatang)} บาท · ${e.txCount} ครั้ง (ยอดรายเดือนคงเดิม)`});
}
function periodOptions(x:SlashCommandSubcommandBuilder) {
  return x.addStringOption(o=>o.setName("period").setDescription("ยอดรวมทั้งหมดหรือเดือนปัจจุบัน").addChoices({name:"ยอดรวมทั้งหมด",value:"all_time"},{name:"เดือนนี้",value:"this_month"}))
    .addStringOption(o=>o.setName("month").setDescription("ดูเดือนที่ระบุ เช่น 2026-10 (ใช้แทน period)").setMinLength(7).setMaxLength(7));
}
async function register(c:FeatureContext) {
  if(!c.guildId)throw new Error("Discord guild is not configured");
  const guild=await c.client.guilds.fetch(c.guildId);
  const cmd=new SlashCommandBuilder().setName("spending").setDescription("จัดการบัตรสะสมยอดใช้จ่ายแบบกรอกเอง");
  cmd.addSubcommand(x=>x.setName("add").setDescription("เพิ่มยอดทั้งยอดรวมและเดือนปัจจุบัน").addUserOption(o=>o.setName("member").setDescription("สมาชิก").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("จำนวนเงินบาท").setMinValue(1).setMaxValue(Math.floor(Number.MAX_SAFE_INTEGER/100)).setRequired(true)));
  cmd.addSubcommand(x=>x.setName("update").setDescription("แก้ไขยอดรวม/จำนวนครั้งทั้งหมด ไม่เปลี่ยนยอดเดือน").addUserOption(o=>o.setName("member").setDescription("สมาชิก").setRequired(true)));
  cmd.addSubcommand(x=>x.setName("delete").setDescription("ลบข้อมูลสมาชิกทุกเดือน").addUserOption(o=>o.setName("member").setDescription("สมาชิก").setRequired(true)));
  cmd.addSubcommand(x=>periodOptions(x.setName("check").setDescription("ตรวจสอบยอดรวมและยอดรายเดือน").addUserOption(o=>o.setName("member").setDescription("สมาชิก"))));
  cmd.addSubcommand(x=>periodOptions(x.setName("list").setDescription("อันดับยอดสะสมทั้งหมดหรือรายเดือน")));
  cmd.addSubcommand(x=>periodOptions(x.setName("total").setDescription("ยอดรวมทั้งหมดหรือรายเดือน")));
  cmd.addSubcommand(x=>periodOptions(x.setName("rank").setDescription("รีเฟรชยศ Top 1 / Top 2–5 ทั้งหมดหรือรายเดือน")));
  await guild.commands.create(cmd.toJSON());
}
function monthlyRolesEnabled(c:FeatureContext) {
  return bool(c.config.SPENDING_MONTHLY_ROLES_ENABLED,false)&&!!(id(c.config.SPENDING_MONTHLY_TOP1_ROLE_ID)||id(c.config.SPENDING_MONTHLY_TOP5_ROLE_ID));
}
async function syncMonthlyRolesAfterWrite(c:FeatureContext,s:MemberSpendingStore,guild:NonNullable<ChatInputCommandInteraction["guild"]>):Promise<boolean> {
  try {await syncMonthlyRoles(c,s,guild);return true;}
  catch(error){console.error("Member Spending monthly role sync failed after saving balances",error);return false;}
}
export async function syncMonthlyRoles(c:FeatureContext,s:MemberSpendingStore,guild:NonNullable<ChatInputCommandInteraction["guild"]>,board?:MemberSpendingEntry[],active:()=>boolean=()=>true) {
  if(!monthlyRolesEnabled(c))return;
  const top1=id(c.config.SPENDING_MONTHLY_TOP1_ROLE_ID),top5=id(c.config.SPENDING_MONTHLY_TOP5_ROLE_ID);
  const lifetimeRoles=[id(c.config.SPENDING_TOP1_ROLE_ID),id(c.config.SPENDING_TOP5_ROLE_ID),id(c.config.SPENDING_FIRST_ROLE_ID),...(Array.isArray(c.config.SPENDING_UPGRADE_TIERS)?c.config.SPENDING_UPGRADE_TIERS.flatMap(t=>isRecord(t)?[id(t.roleId)]:[]):[])];
  if(top1&&top1===top5||[top1,top5].some(role=>role&&lifetimeRoles.includes(role)))throw new Error("กรุณาใช้ยศประจำเดือนแยกจากยศยอดรวมและแยกแต่ละอันดับ");
  const ranked=(board??await s.leaderboard(5,spendingMonth())).filter(e=>e.amountSatang>0);
  if(!active())return;
  const reset=bool(c.config.SPENDING_MONTHLY_ROLES_RESET,true);
  const members=await guild.members.fetch();
  for(const member of members.values()) {
    if(!active())return;
    const first=member.id===ranked[0]?.memberDiscordId;
    const rest=ranked.slice(1,5).some(e=>e.memberDiscordId===member.id);
    if(top1&&(reset||first))await safeRole(member,top1,first);
    if(top5&&(reset||rest))await safeRole(member,top5,rest);
  }
}

async function applyRoles(c:FeatureContext,m:GuildMember,amount:number,count:number){const first=id(c.config.SPENDING_FIRST_ROLE_ID);if(first)await safeRole(m,first,true);const tiers=Array.isArray(c.config.SPENDING_UPGRADE_TIERS)?c.config.SPENDING_UPGRADE_TIERS.flatMap(x=>isRecord(x)&&Number(x.amount)>0&&id(x.roleId)?[{amount:Number(x.amount)*100,roleId:id(x.roleId)!}]:[]):[];const qualified=tiers.filter(t=>amount>=t.amount||(bool(c.config.SPENDING_COUNT_ENABLED,false)&&count>=num(c.config.SPENDING_UPGRADE_COUNT,5)));if(bool(c.config.SPENDING_TIER_STACK,true)){for(const t of qualified)await safeRole(m,t.roleId,true);}else for(const t of tiers)await safeRole(m,t.roleId,t===qualified.at(-1));}
async function syncRankRoles(c:FeatureContext,guild:NonNullable<ChatInputCommandInteraction["guild"]>,board:Awaited<ReturnType<MemberSpendingStore["leaderboard"]>>){const top1=id(c.config.SPENDING_TOP1_ROLE_ID),top5=id(c.config.SPENDING_TOP5_ROLE_ID);if(!top1&&!top5)return;const members=await guild.members.fetch();for(const m of members.values()){if(top1)await safeRole(m,top1,m.id===board[0]?.memberDiscordId);if(top5)await safeRole(m,top5,board.slice(1,5).some(e=>e.memberDiscordId===m.id));}}
async function safeRole(m:GuildMember,roleId:string,add:boolean){const role=m.guild.roles.cache.get(roleId),me=m.guild.members.me;if(!role||!me?.permissions.has(PermissionFlagsBits.ManageRoles)||me.roles.highest.comparePositionTo(role)<=0)return;if(add&&!m.roles.cache.has(roleId))await m.roles.add(roleId);if(!add&&m.roles.cache.has(roleId))await m.roles.remove(roleId);}
function render(c:FeatureContext,slot:string,v:Record<string,string>):Record<string,unknown>{if((slot==="leaderboard"||slot==="monthly_leaderboard")&&!isRecord(c.presentations[slot]))return{embeds:[new EmbedBuilder().setTitle(slot==="monthly_leaderboard"?`อันดับประจำเดือน ${v.month}`:"อันดับยอดสะสมทั้งหมด").setDescription(v.leaderboard_lines||"ยังไม่มีข้อมูล")]};const raw=isRecord(c.presentations[slot])?c.presentations[slot]:{};if(raw.mode==="COMPONENTS_V2"&&Array.isArray(raw.components))return{flags:MessageFlags.IsComponentsV2,components:deep(raw.components,v)};if(raw.mode==="EMBED"&&Array.isArray(raw.embeds))return{content:fill(String(raw.content??""),v)||undefined,embeds:deep(raw.embeds,v)};return{embeds:[new EmbedBuilder().setColor(0xe46daf).setTitle(fill(String(raw.title??"บัตรสะสมของ {{member}}"),v)).setDescription(fill(String(raw.description??"ยอดรอบนี้ {{today}} บาท\nยอดสะสม {{total}} บาท · {{count}} ครั้ง"),v)).setThumbnail(v.avatar??null)]};}
function vars(uid:string,name:string,today:number,e:MemberSpendingEntry,avatar:string){return{member:name,member_mention:`<@${uid}>`,today:money(today),total:money(e.amountSatang),count:String(e.txCount),this_month:money(e.thisMonthSatang??0),this_month_count:String(e.thisMonthTxCount??0),month:spendingMonth(),avatar};}
function deep(x:unknown,v:Record<string,string>):unknown{if(typeof x==="string")return fill(x,v);if(Array.isArray(x))return x.map(y=>deep(y,v));if(isRecord(x))return Object.fromEntries(Object.entries(x).map(([k,y])=>[k,deep(y,v)]));return x;}function fill(x:string,v:Record<string,string>){return x.replace(/\{\{([a-z0-9_]+)}}/gi,(_,k:string)=>v[k]??"");}
function row(customId:string,label:string,required:boolean){return new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(customId).setLabel(label).setStyle(TextInputStyle.Short).setRequired(required));}function parseOptional(x:string,m:number){if(!x.trim())return undefined;if(!/^\d+(?:\.\d{1,2})?$/.test(x.trim()))throw new Error("กรุณากรอกตัวเลขที่ไม่ติดลบ");const result=Number(x)*m;if(!Number.isSafeInteger(Math.round(result))||(m===1&&!Number.isInteger(result)))throw new Error("จำนวนครั้งต้องเป็นจำนวนเต็ม และยอดต้องไม่เกินขอบเขตที่รองรับ");return Math.round(result);}function money(x:number){return(x/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});}function bool(x:unknown,f:boolean){return typeof x==="boolean"?x:f;}function num(x:unknown,f:number){return typeof x==="number"?x:f;}function id(x:unknown){const s=String(x??"");return/^\d{15,30}$/.test(s)?s:undefined;}function requiredSecret(x:unknown){if(typeof x!=="string"||!/^postgres(?:ql)?:\/\//i.test(x))throw new Error("SPENDING_DB_URL must be a PostgreSQL connection URL");return x;}function isRecord(x:unknown):x is Record<string,unknown>{return!!x&&typeof x==="object"&&!Array.isArray(x);}async function respondError(i:Interaction,e:unknown){if(!i.isRepliable())return;const content=`ทำรายการไม่สำเร็จ: ${e instanceof Error?e.message:"Unknown error"}`;if(i.deferred||i.replied)await i.editReply(content).catch(()=>{});else await i.reply({content,flags:MessageFlags.Ephemeral}).catch(()=>{});}
