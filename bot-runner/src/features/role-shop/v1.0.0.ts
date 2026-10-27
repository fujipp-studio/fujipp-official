import { randomUUID } from "node:crypto";
import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits,
  SlashCommandBuilder, StringSelectMenuBuilder,
  type Guild, type Interaction, type RepliableInteraction,
} from "discord.js";
import type { FeatureContext, FeatureModule, RoleShopPurchase } from "../../types.js";
import { RuntimeApiError } from "../../api-client.js";
import { renderTemplate } from "../presentation.js";
import { replyFeatureError, safeErrorText } from "../errors.js";

const PREFIX="fujipp:role-shop:";
export interface RoleShopProduct { key: string; name: string; roleId: string; priceSatang: number; }
interface Quote { member: string; product: RoleShopProduct; expiresAt: number; }

export function roleShopProducts(value: unknown): RoleShopProduct[] {
  if (!Array.isArray(value) || value.length>25) throw new Error("กำหนดรายการยศได้สูงสุด 25 รายการ");
  const keys=new Set<string>(), roles=new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item!=="object") throw new Error("รายการยศไม่ถูกต้อง");
    const row=item as Record<string,unknown>;
    if (typeof row.key!=="string" || !/^[a-z0-9_-]{1,40}$/.test(row.key) || keys.has(row.key)
      || typeof row.name!=="string" || !row.name.trim() || row.name.length>100
      || typeof row.roleId!=="string" || !/^\d{15,30}$/.test(row.roleId) || roles.has(row.roleId)
      || typeof row.priceSatang!=="number" || !Number.isSafeInteger(row.priceSatang) || row.priceSatang<=0)
      throw new Error("กำหนดชื่อยศ รหัสสินค้า Role ID ที่ไม่ซ้ำ และราคาสตางค์ที่มากกว่าศูนย์");
    keys.add(row.key); roles.add(row.roleId);
    return {key:row.key,name:row.name,roleId:row.roleId,priceSatang:row.priceSatang};
  });
}

export const roleShopFeature: FeatureModule = {
  runtimeKey:"role-shop", version:"1.0.0", intents:["Guilds"],
  async activate(context) {
    if (!context.installedFeatureCodes.has("wallet-topup")) throw new Error("Role Shop ต้องติดตั้ง Wallet Top-up บนบอทเดียวกัน");
    const products=roleShopProducts(context.config.ROLE_SHOP_PRODUCTS ?? []);
    const command=String(context.config.ROLE_SHOP_COMMAND_NAME ?? "role-shop-panel");
    if (!/^[a-z0-9_-]{1,32}$/.test(command)) throw new Error("คำสั่งแผงขายยศไม่ถูกต้อง");
    const quotes=new Map<string,Quote>();
    const confirming=new Set<string>(), delivering=new Set<string>();
    let recovering=false, disposed=false;
    async function deliver(purchase: RoleShopPurchase): Promise<RoleShopPurchase|null> {
      if (delivering.has(purchase.id)) return null;
      delivering.add(purchase.id);
      try { return await fulfillRoleShopPurchase(context,purchase); }
      finally { delivering.delete(purchase.id); }
    }
    async function recover() {
      if (recovering || disposed) return;
      recovering=true;
      try {
        for (const job of await context.roleShop.recoverable()) {
          if (disposed) break;
          const result=await deliver(job);
          if (result?.status==="SUCCEEDED") await notify(context,result);
        }
      } catch (error) { await report(context,error); }
      finally { recovering=false; }
    }
    async function ready() {
      await context.client.application?.commands.create(new SlashCommandBuilder().setName(command)
        .setDescription("ส่งแผงขายยศด้วยยอดเงิน Wallet").toJSON());
      await recover();
    }
    const onReady=() => { void ready().catch((error)=>report(context,error)); };
    const timer=setInterval(() => {
      for (const [id,quote] of quotes) if (quote.expiresAt<Date.now() && !confirming.has(id)) quotes.delete(id);
      void recover();
    },30_000);
    async function handle(interaction: Interaction) {
      if (!interaction.inGuild() || interaction.guildId!==context.guildId) return;
      if (interaction.isChatInputCommand() && interaction.commandName===command) {
        if (!context.permissions.canUse(interaction,command,false))
          return replyFeatureError(interaction,"role-shop","คุณไม่มีสิทธิ์ส่งแผงขายยศ",{code:"COMMAND_PERMISSION_DENIED"});
        if (!products.length) throw new Error("กรุณาเพิ่มยศที่ขายในการตั้งค่า Feature ก่อน");
        await interaction.deferReply({flags:MessageFlags.Ephemeral});
        const channel=interaction.channel;
        if (!channel?.isSendable()) throw new Error("ส่งแผงขายยศในห้องนี้ไม่ได้");
        const menu=new StringSelectMenuBuilder().setCustomId(`${PREFIX}select`).setPlaceholder("เลือกยศที่ต้องการซื้อ")
          .addOptions(products.map((product)=>({label:product.name,value:product.key,description:`${money(product.priceSatang)} THB`})));
        const wallet=new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId("fujipp:wallet:topup").setLabel("เติมเงิน").setEmoji("💰").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("fujipp:wallet:balance").setLabel("เช็คยอดเงิน").setStyle(ButtonStyle.Secondary));
        await channel.send(render(context,"panel",{
          product_lines:products.map((product)=>`• <@&${product.roleId}> — **${money(product.priceSatang)} THB**`).join("\n"),
        },[new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),wallet]) as never);
        return interaction.editReply({content:"ส่งแผงขายยศแล้ว"});
      }
      if (interaction.isStringSelectMenu() && interaction.customId===`${PREFIX}select`) {
        const product=products.find((row)=>row.key===interaction.values[0]);
        if (!product) throw new Error("ยศนี้ไม่เปิดขายแล้ว กรุณาเลือกใหม่");
        await interaction.deferReply({flags:MessageFlags.Ephemeral});
        const guild=await context.client.guilds.fetch(interaction.guildId);
        const member=await guild.members.fetch({user:interaction.user.id,force:true});
        if (member.roles.cache.has(product.roleId)) throw new Error("คุณมียศนี้อยู่แล้ว");
        await requireSellableRole(guild,product.roleId);
        const balance=await context.wallet.balance(interaction.user.id);
        if (balance.balanceSatang<product.priceSatang) throw new Error("ยอดเงินใน Wallet ไม่เพียงพอ กรุณากดเติมเงินก่อน");
        const id=randomUUID();
        quotes.set(id,{member:interaction.user.id,product,expiresAt:Date.now()+5*60_000});
        const buttons=new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`${PREFIX}confirm:${id}`).setLabel("ยืนยันซื้อยศ").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`${PREFIX}cancel:${id}`).setLabel("ยกเลิก").setStyle(ButtonStyle.Secondary));
        return interaction.editReply(render(context,"confirmation",{...productValues(product),balance:money(balance.balanceSatang)},[buttons]) as never);
      }
      if (!interaction.isButton() || !interaction.customId.startsWith(PREFIX)) return;
      const match=interaction.customId.match(/^fujipp:role-shop:(confirm|cancel):([a-f0-9-]{36})$/);
      if (!match) return;
      const id=match[2]!, quote=quotes.get(id);
      if (!quote || quote.member!==interaction.user.id || quote.expiresAt<Date.now()) throw new Error("รายการยืนยันหมดอายุ กรุณาเลือกยศใหม่");
      if (confirming.has(id)) return;
      if (match[1]==="cancel") {
        quotes.delete(id);
        return interaction.update({content:"ยกเลิกการซื้อยศแล้ว",embeds:[],components:[]});
      }
      confirming.add(id);
      try {
        await interaction.deferUpdate();
        const guild=await context.client.guilds.fetch(interaction.guildId);
        const member=await guild.members.fetch({user:interaction.user.id,force:true});
        if (member.roles.cache.has(quote.product.roleId)) throw new Error("คุณมียศนี้อยู่แล้ว");
        await requireSellableRole(guild,quote.product.roleId);
        const purchase=await context.roleShop.begin({memberDiscordId:interaction.user.id,productKey:quote.product.key,
          roleId:quote.product.roleId,priceSatang:quote.product.priceSatang,idempotencyKey:`role-shop:${id}`});
        quotes.delete(id);
        const result=["SUCCEEDED","REFUNDED"].includes(purchase.status)?purchase:await deliver(purchase);
        if (result?.status==="SUCCEEDED") {
          await interaction.editReply(render(context,"succeeded",purchaseValues(result),[]) as never);
          await notify(context,result);
        } else if (result?.status==="REFUNDED") {
          await interaction.editReply(render(context,"failed",{failure_reason:"มอบยศไม่สำเร็จ คืนเงินเข้า Wallet แล้ว"},[]) as never);
        } else {
          await interaction.editReply({content:"ระบบกำลังตรวจสอบการมอบยศ รายการถูกบันทึกแล้ว ไม่ต้องซื้อซ้ำ",embeds:[],components:[]});
        }
      } finally { confirming.delete(id); }
    }
    const listener=(interaction: Interaction) => { void handle(interaction).catch(async(error)=>{
      if (interaction.isRepliable()) await showError(context,interaction,error);
    }); };
    context.client.on("interactionCreate",listener);
    if (context.client.isReady()) onReady(); else context.client.once("clientReady",onReady);
    return () => { disposed=true; clearInterval(timer); quotes.clear(); context.client.off("interactionCreate",listener); context.client.off("clientReady",onReady); };
  },
};

class RoleDeliveryError extends Error {}
async function requireSellableRole(guild: Guild,roleId: string) {
  const me=await guild.members.fetchMe();
  const role=await guild.roles.fetch(roleId);
  if (!role || role.id===guild.id || role.managed || !role.editable)
    throw new RoleDeliveryError("ยศนี้ไม่สามารถมอบได้ ตรวจสอบ Role ID และให้ยศบอทอยู่สูงกว่ายศที่ขาย");
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) throw new RoleDeliveryError("บอทต้องมีสิทธิ์ Manage Roles เพื่อขายยศ");
  return role;
}
export function isDefinitiveRoleFailure(error: unknown): boolean {
  if (error instanceof RoleDeliveryError) return true;
  const status=error && typeof error==="object" && "status" in error ? Number(error.status) : 0;
  return status>=400 && status<500 && status!==429;
}
/** Discord's single-role PUT is idempotent; uncertain delivery is recovered, never refunded blindly. */
export async function fulfillRoleShopPurchase(context: FeatureContext,purchase: RoleShopPurchase): Promise<RoleShopPurchase|null> {
  let claimed: RoleShopPurchase;
  try { claimed=await context.roleShop.claim(purchase.id); }
  catch (error) {
    if (error instanceof RuntimeApiError && error.code==="PURCHASE_BUSY") return null;
    throw error;
  }
  if (!claimed.claimToken) throw new Error("รายการซื้อยศไม่มีรหัสประมวลผล");
  try {
    if (!context.guildId) throw new RoleDeliveryError("บอทยังไม่ได้ตั้งค่าเซิร์ฟเวอร์");
    const guild=await context.client.guilds.fetch(context.guildId);
    const member=await guild.members.fetch({user:claimed.memberDiscordId,force:true});
    if (!member.roles.cache.has(claimed.roleId)) {
      await requireSellableRole(guild,claimed.roleId);
      await member.roles.add(claimed.roleId,`Role Shop purchase ${claimed.id}`);
    }
  } catch (error) {
    if (isDefinitiveRoleFailure(error))
      return context.roleShop.refund(claimed.id,claimed.claimToken,safeErrorText(error instanceof Error?error.message:"Discord ปฏิเสธการมอบยศ",500) || "Discord ปฏิเสธการมอบยศ");
    await report(context,error);
    return null;
  }
  // A lost completion response must never trigger a refund after a successful role grant.
  try { return await context.roleShop.complete(claimed.id,claimed.claimToken); }
  catch (error) { await report(context,error); return null; }
}
function money(satang: number) { return (satang/100).toFixed(2); }
function productValues(product: RoleShopProduct) { return {product_name:product.name,role_mention:`<@&${product.roleId}>`,price:money(product.priceSatang)}; }
function purchaseValues(purchase: RoleShopPurchase) {
  return {...productValues({key:purchase.productKey,name:purchase.productName,roleId:purchase.roleId,priceSatang:purchase.priceSatang}),
    member_mention:`<@${purchase.memberDiscordId}>`,balance:money(purchase.balanceSatang),transaction_id:purchase.id,
    transaction_time:new Date(purchase.createdAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})};
}
function render(context: FeatureContext,slot: string,values: Record<string,string>,rows: unknown[]): Record<string,unknown> {
  const payload=renderTemplate(context,slot,{currency:"THB",...values});
  return {...payload,components:[...(Array.isArray(payload.components)?payload.components:[]),...rows],allowedMentions:{parse:[]}};
}
async function notify(context: FeatureContext,purchase: RoleShopPurchase) {
  const channelId=String(context.config.ROLE_SHOP_NOTIFICATION_CHANNEL_ID ?? "");
  if (!channelId) return;
  try {
    const channel=await context.client.channels.fetch(channelId);
    if (channel?.isSendable()) await channel.send(render(context,"succeeded",purchaseValues(purchase),[]) as never);
  } catch (error) { await report(context,error); }
}
async function report(context: FeatureContext,error: unknown) {
  await context.reportFeatureError("ROLE_PURCHASE_PENDING",error,{recoverable:true}).catch(()=>undefined);
}
async function showError(context: FeatureContext,interaction: RepliableInteraction,error: unknown) {
  const message=error instanceof Error?safeErrorText(error.message,500):"ซื้อยศไม่สำเร็จ กรุณาลองใหม่";
  try {
    const payload=render(context,"failed",{failure_reason:message},[]);
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload as never);
    else await interaction.reply({...payload,flags:Number(payload.flags ?? 0)|MessageFlags.Ephemeral} as never);
  } catch { await replyFeatureError(interaction,"role-shop",message,{code:"ROLE_PURCHASE_FAILED"}); }
}
