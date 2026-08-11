import {
  ActionRowBuilder, Attachment, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction,
  Interaction, Message, MessageFlags, ModalBuilder, PermissionFlagsBits, SlashCommandBuilder,
  TextInputBuilder, TextInputStyle, type GuildTextBasedChannel, type User,
} from "discord.js";
import type { FeatureContext, FeatureModule, WalletAdjustmentOperation, WalletAdjustmentResult, WalletTopupResult } from "../../types.js";
import { RuntimeApiError } from "../../api-client.js";

const ACTIONS = {
  "wallet.topup": { id: "fujipp:wallet:topup", label: "เติมเงิน", emoji: "💰", style: ButtonStyle.Success },
  "wallet.balance": { id: "fujipp:wallet:balance", label: "เช็คยอดเงินคงเหลือ", emoji: "💳", style: ButtonStyle.Secondary },
  "wallet.promptpay": { id: "fujipp:wallet:promptpay", label: "พร้อมเพย์ธนาคาร", emoji: "🏦", style: ButtonStyle.Primary },
  "wallet.truemoney": { id: "fujipp:wallet:truemoney", label: "ซองอั่งเปาทรูมันนี่", emoji: "🧧", style: ButtonStyle.Danger },
} as const;

export const walletTopupFeature: FeatureModule = {
  runtimeKey: "wallet-topup", version: "1.0.0", intents: ["Guilds", "GuildMessages", "MessageContent"],
  async activate(context) {
    const panelCommand = stringConfig(context.config.PANEL_COMMAND_NAME, "wallet-panel");
    const pendingSessions = readPendingSessions(context.runtimeState.walletPendingSessions);
    const countdowns = new Map<string, ReturnType<typeof setInterval>>();
    const slipStatusMessages = new Map<string,string>();
    const cleanupTimer=setInterval(()=>void cleanupExpiredSessions(context,pendingSessions,countdowns).catch(console.error),30_000);

    const onInteraction = (interaction: Interaction) => void handle(context, panelCommand, pendingSessions, countdowns, interaction)
      .catch((error) => respondError(context, interaction, error));
    const onMessage = (message: Message) => void handleSlipMessage(context, pendingSessions, countdowns, slipStatusMessages, message)
      .catch((error) => respondMessageError(context, message, error));
    context.client.on("interactionCreate", onInteraction);
    context.client.on("messageCreate", onMessage);
    context.client.once("clientReady", () => {void cleanupExpiredSessions(context,pendingSessions,countdowns).catch(console.error);void registerCommands(context, panelCommand).catch((error)=>{console.error(`Wallet command registration failed for ${context.botId}:`,error);void context.reportFeatureError("COMMAND_REGISTRATION_FAILED",error);});});
    return () => { context.client.off("interactionCreate", onInteraction); context.client.off("messageCreate", onMessage); clearInterval(cleanupTimer); for(const timer of countdowns.values())clearInterval(timer); };
  },
};

async function registerCommands(context: FeatureContext, panelCommand: string) {
  await context.client.application?.commands.create(new SlashCommandBuilder()
    .setName(panelCommand).setDescription("ส่ง Panel ระบบเติมเงิน").toJSON());
  await context.client.application?.commands.create(new SlashCommandBuilder()
    .setName("topup-slip").setDescription("แนบสลิปสำหรับรายการพร้อมเพย์")
    .addStringOption((o) => o.setName("session").setDescription("รหัสรายการจากหน้า QR").setRequired(true))
    .addAttachmentOption((o) => o.setName("slip").setDescription("รูปสลิปธนาคาร").setRequired(true)).toJSON());
  const admin = new SlashCommandBuilder().setName("wallet-admin").setDescription("ดูหรือปรับยอดเงินสมาชิก");
  admin.addSubcommand((s) => s.setName("balance").setDescription("ดูยอดเงินสมาชิก")
    .addUserOption((o) => o.setName("member").setDescription("สมาชิก").setRequired(true)));
  for (const [name, description] of [["add","เพิ่มเงิน"],["remove","ลบเงิน"],["set","ตั้งยอดเงิน"]] as const) {
    admin.addSubcommand((s) => s.setName(name).setDescription(description)
      .addUserOption((o) => o.setName("member").setDescription("สมาชิก").setRequired(true))
      .addNumberOption((o) => o.setName("amount").setDescription("จำนวนเงินบาท").setMinValue(name === "set" ? 0 : 0.01).setRequired(true))
      .addStringOption((o) => o.setName("reason").setDescription("เหตุผล (บันทึกในประวัติ)").setMaxLength(300).setRequired(true)));
  }
  await context.client.application?.commands.create(admin.toJSON());
  await context.client.application?.commands.create(new SlashCommandBuilder().setName("history").setDescription("ดูประวัติกระเป๋าเงินของสมาชิก")
    .addUserOption((o)=>o.setName("member").setDescription("สมาชิก").setRequired(true))
    .addIntegerOption((o)=>o.setName("limit").setDescription("จำนวนรายการ 1-50").setMinValue(1).setMaxValue(50)).toJSON());
  await context.client.application?.commands.create(new SlashCommandBuilder().setName("topup-monthly").setDescription("ดูยอดเติมเงินในหนึ่งเดือนล่าสุด")
    .addUserOption((o)=>o.setName("member").setDescription("เว้นว่างเพื่อดูยอดรวมทั้งร้าน")).toJSON());
  await context.client.application?.commands.create(new SlashCommandBuilder().setName("top").setDescription("แสดง Top 10 และอัปเดตยศผู้เติมสูงสุด").toJSON());
  console.info(`Wallet Top-up active: bot ${context.botId}`);
}

async function handle(context: FeatureContext, panelCommand: string, pending: Map<string, PendingSession>, countdowns:Map<string,ReturnType<typeof setInterval>>, interaction: Interaction) {
  if (interaction.isChatInputCommand()) {
    const subcommand = interaction.options.getSubcommand(false);
    const permissionKey = subcommand ? `${interaction.commandName}/${subcommand}` : interaction.commandName;
    if (!context.permissions.canUse(interaction, permissionKey)) {
      return interaction.reply({ content: "คุณไม่มีสิทธิ์ใช้คำสั่งนี้", flags: MessageFlags.Ephemeral });
    }
    if (interaction.commandName === panelCommand) return postPanel(context, interaction);
    if (interaction.commandName === "topup-slip") return verifySlip(context, pending, countdowns, interaction);
    if (interaction.commandName === "wallet-admin") return walletAdmin(context, interaction);
    if (interaction.commandName === "history") return walletHistory(context,interaction);
    if (interaction.commandName === "topup-monthly") return monthlySummary(context,interaction);
    if (interaction.commandName === "top") return topSpenders(context,interaction);
    return;
  }
  if (interaction.isButton()) {
    if (interaction.customId === ACTIONS["wallet.topup"].id) return interaction.reply(render(context,"method_selector",vars(context,interaction.user.id),true));
    if (interaction.customId === ACTIONS["wallet.balance"].id) {
      const balance=await context.wallet.balance(interaction.user.id);
      return interaction.reply(render(context,"balance",{...vars(context,interaction.user.id),balance:money(balance.balanceSatang),currency:balance.currency},true));
    }
    if (interaction.customId === ACTIONS["wallet.truemoney"].id) return interaction.showModal(modal("wallet:voucher","เติมเงินด้วยซองอั่งเปา","gift_url","ลิงก์ซองอั่งเปา",TextInputStyle.Short));
    if (interaction.customId === ACTIONS["wallet.promptpay"].id) return interaction.showModal(promptPayModal(context));
  }
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "wallet:voucher") {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result=await context.wallet.voucher({memberDiscordId:interaction.user.id,giftUrl:interaction.fields.getTextInputValue("gift_url").trim(),idempotencyKey:`discord:${interaction.id}`});
      await grantPermanentTopupRole(context,interaction.guild,interaction.user.id);
      await syncTopSpenderRoles(context,interaction.guild).catch(console.error);
      await notify(context, successVars(interaction.user.id,result,"ระบบ","เติมเงินสำเร็จ","-")).catch(console.error);
      return interaction.editReply(render(context,"succeeded",successVars(interaction.user.id,result),false));
    }
    if (interaction.customId === "wallet:promptpay") {
      const amount=parseAmount(interaction.fields.getTextInputValue("amount"));
      const minimum=numberConfig(context.config.MIN_TOPUP_SATANG,1000);
      if(amount<minimum)return interaction.reply(render(context,"minimum_warning",{minimum_amount:money(minimum)},true));
      const session=await context.wallet.createPromptPay(interaction.user.id,amount);
      const grantedRole=await grantTemporarySlipRole(context,interaction.guild,interaction.user.id);
      pending.set(interaction.user.id,{sessionId:session.sessionId,expiresAt:session.expiresAt,grantedRole});
      await savePending(context,pending);
      const qrVars={...vars(context,interaction.user.id),amount:money(session.amountSatang),currency:session.currency,account_name:session.accountName,remaining_time:formatRemaining(session.expiresAt),qr_url:session.qrUrl,session_id:session.sessionId,slip_channel_url:slipChannelUrl(context)};
      await interaction.reply(render(context,"promptpay_qr",qrVars,true));
      startCountdown(context,pending,countdowns,interaction,session.expiresAt,session.sessionId,qrVars);
      return;
    }
  }
}

async function handleSlipMessage(context: FeatureContext, pending: Map<string, PendingSession>, countdowns:Map<string,ReturnType<typeof setInterval>>, statusMessages:Map<string,string>, message: Message) {
  const slipChannelId=stringConfig(context.config.SLIP_CHANNEL_ID,"");
  if (!slipChannelId || message.channelId!==slipChannelId || message.author.bot || !message.inGuild()) return;
  const roleId=stringConfig(context.config.SLIP_SUBMITTER_ROLE_ID,"");
  if (!roleId || !message.member?.roles.cache.has(roleId)) {
    await message.reply("คุณไม่มียศสำหรับส่งสลิปในห้องนี้"); return;
  }
  const slip=[...message.attachments.values()].find((a)=>a.contentType?.startsWith("image/"));
  if (!slip) { await message.reply("กรุณาส่งรูปสลิปเป็นไฟล์แนบ"); return; }
  const session=pending.get(message.author.id);
  if (session && Date.parse(session.expiresAt)<=Date.now()) {
    clearCountdown(countdowns,message.author.id); await removeTemporarySlipRole(context,message.guild,message.author.id);
    pending.delete(message.author.id); await savePending(context,pending);
    await message.reply(render(context,"expired",{session_id:session.sessionId},false)); return;
  }
  let processing:Message|undefined;
  const previousId=statusMessages.get(message.author.id);
  if(previousId){const previous=await message.channel.messages.fetch(previousId).catch(()=>undefined);if(previous&&previous.author.id===context.client.user?.id)await previous.delete().catch(()=>undefined);}
  processing=await message.reply(render(context,"processing",{payment_method:"QR (SlipOK)"},false));
  statusMessages.set(message.author.id,processing.id);
  let result:WalletTopupResult;
  try{result=await context.wallet.verifySlip({...(session?{sessionId:session.sessionId}:{}),memberDiscordId:message.author.id,slipImageUrl:slip.url,idempotencyKey:`discord:${message.id}`});}
  catch(error){const failure=humanWalletError(error);await processing.edit(render(context,"failed",{failure_reason:failure.message,failure_code:failure.code},false));return;}
  clearCountdown(countdowns,message.author.id);
  await removeTemporarySlipRole(context,message.guild,message.author.id);
  pending.delete(message.author.id); await savePending(context,pending);
  await grantPermanentTopupRole(context,message.guild,message.author.id);
  await syncTopSpenderRoles(context,message.guild).catch(console.error);
  await processing.edit(render(context,"succeeded",successVars(message.author.id,result),false));
  statusMessages.delete(message.author.id);
  await notify(context,successVars(message.author.id,result,"ระบบ","เติมเงินสำเร็จ","-"));
}

async function walletAdmin(context:FeatureContext,interaction:ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !(await isWalletAdmin(context,interaction)))
    return interaction.reply({content:"คุณไม่มีสิทธิ์จัดการกระเป๋าเงิน",flags:MessageFlags.Ephemeral});
  const member=interaction.options.getUser("member",true) as User;
  const sub=interaction.options.getSubcommand();
  if(sub==="balance"){
    const balance=await context.wallet.balance(member.id);
    return interaction.reply(render(context,"balance",{...vars(context,member.id),balance:money(balance.balanceSatang),currency:balance.currency},true));
  }
  const operation=sub.toUpperCase() as WalletAdjustmentOperation;
  const amount=parseAmount(String(interaction.options.getNumber("amount",true)));
  const reason=interaction.options.getString("reason",true).trim();
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  const result=await context.wallet.adjust({memberDiscordId:member.id,actorDiscordId:interaction.user.id,operation,amountSatang:amount,reason,idempotencyKey:`discord:${interaction.id}`});
  const values=adjustmentVars(member.id,interaction.user.id,result,reason);
  await notify(context,values);
  return interaction.editReply({content:`${operationLabel(operation)} ${money(Math.abs(result.adjustmentSatang))} THB สำเร็จ ยอดคงเหลือ ${money(result.balanceSatang)} THB`});
}

async function isWalletAdmin(context:FeatureContext,interaction:ChatInputCommandInteraction){
  if(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))return true;
  const roleId=stringConfig(context.config.WALLET_ADMIN_ROLE_ID,"");
  if(!roleId||!interaction.guild)return false;
  const member=await interaction.guild.members.fetch(interaction.user.id);
  return member.roles.cache.has(roleId);
}

async function notify(context:FeatureContext,values:Record<string,string>){
  const channelId=stringConfig(context.config.TOPUP_NOTIFICATION_CHANNEL_ID,"");
  if(!channelId)return;
  const channel=await context.client.channels.fetch(channelId);
  if(channel?.isTextBased()&&channel.isSendable())await channel.send(render(context,"admin_notification",values,false));
}

async function postPanel(context: FeatureContext, interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator))
    return interaction.reply({content:"คำสั่งนี้ใช้ได้เฉพาะผู้ดูแลเซิร์ฟเวอร์",flags:MessageFlags.Ephemeral});
  const channel=interaction.channel as GuildTextBasedChannel | null;
  if (!channel?.isSendable()) throw new Error("Channel cannot send messages");
  await channel.send(render(context,"panel",vars(context,interaction.user.id),false));
  await interaction.reply({content:"ส่ง Panel เติมเงินเรียบร้อย",flags:MessageFlags.Ephemeral});
}

async function verifySlip(context: FeatureContext, pending: Map<string, PendingSession>, countdowns:Map<string,ReturnType<typeof setInterval>>, interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  const sessionId=interaction.options.getString("session",true);
  const slip=interaction.options.getAttachment("slip",true) as Attachment;
  await interaction.editReply(render(context,"processing",{payment_method:"QR (SlipOK)"},false));
  const result=await context.wallet.verifySlip({sessionId,memberDiscordId:interaction.user.id,slipImageUrl:slip.url,idempotencyKey:`discord:${interaction.id}`});
  clearCountdown(countdowns,interaction.user.id);
  await removeTemporarySlipRole(context,interaction.guild,interaction.user.id);
  const session=pending.get(interaction.user.id);
  if(session?.sessionId===sessionId){pending.delete(interaction.user.id);await savePending(context,pending);}
  await grantPermanentTopupRole(context,interaction.guild,interaction.user.id);
  await syncTopSpenderRoles(context,interaction.guild).catch(console.error);
  await interaction.editReply(render(context,"succeeded",successVars(interaction.user.id,result),false));
  await notify(context,successVars(interaction.user.id,result,"ระบบ","เติมเงินสำเร็จ","-"));
}

function render(context:FeatureContext,slot:string,values:Record<string,string>,ephemeral:boolean): never {
  const raw=isRecord(context.presentations[slot])?context.presentations[slot]:{};
  // Advanced overrides may provide the complete Discord payload. Every nested
  // string is templated and `{ "action": "wallet.topup" }` becomes the stable
  // reusable button, so owners can add/remove/reorder every component.
  if (raw.mode === "COMPONENTS_V2" && Array.isArray(raw.components)) {
    return {
      flags:(ephemeral?MessageFlags.Ephemeral:0)|MessageFlags.IsComponentsV2,
      components:deepRender(raw.components,values),
    } as never;
  }
  if (raw.mode === "EMBED" && Array.isArray(raw.embeds)) {
    return {
      content:typeof raw.content==="string"?replace(raw.content,values):null,
      embeds:deepRender(raw.embeds,values),
      components:Array.isArray(raw.components)?deepRender(raw.components,values):[],
      ...(ephemeral?{flags:MessageFlags.Ephemeral}:{}),
    } as never;
  }
  const nested=raw.mode==="EMBED"&&isRecord(raw.embed)?raw.embed:raw.mode==="COMPONENTS_V2"&&isRecord(raw.components_v2)?raw.components_v2:{};
  const definition={...raw,...nested};
  const title=replace(String(definition.title??""),values), description=replace(String(definition.description??""),values);
  const actionCodes=Array.isArray(definition.actions)?definition.actions.filter((x):x is keyof typeof ACTIONS=>typeof x==="string"&&x in ACTIONS):[];
  const actionOverrides=isRecord(definition.action_overrides)?definition.action_overrides:{};
  const buttons=actionCodes.map((code)=>{
    const a=ACTIONS[code],override=isRecord(actionOverrides[code])?actionOverrides[code]:{};
    const label=replace(String(override.label??a.label),values),emoji=replace(String(override.emoji??a.emoji),values);
    const button=new ButtonBuilder().setCustomId(a.id).setLabel(label.slice(0,80)).setStyle(buttonStyle(override.style,a.style));
    if(emoji)button.setEmoji(emoji);
    return button;
  });
  if(Array.isArray(definition.links))for(const item of definition.links){if(isRecord(item)){const url=replace(String(item.url??""),values);if(url)buttons.push(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(replace(String(item.label??"เปิดลิงก์"),values)).setEmoji(replace(String(item.emoji??"🔗"),values)));}}
  const row=buttons.length?new ActionRowBuilder<ButtonBuilder>().addComponents(buttons):undefined;
  if (raw.mode === "EMBED") return {
    content:replace(String(definition.content??""),values)||undefined,
    embeds:[{title,url:optionalText(definition.url,values),description,color:embedColor(definition.color),author:embedAuthor(definition.author,values),fields:Array.isArray(definition.fields)?deepRender(definition.fields,values):[],footer:embedFooter(definition.footer,values),timestamp:embedTimestamp(definition.timestamp),image:urlObject(replace(String(definition.image_url??""),values)),thumbnail:urlObject(replace(String(definition.thumbnail_url??""),values))}],
    components:row?[row]:[],...(ephemeral?{flags:MessageFlags.Ephemeral}:{})
  } as never;
  if (Array.isArray(definition.components)) {
    const components=normalizeComponentColors(deepRender(definition.components,values));
    if(row) components.push(row.toJSON());
    return {flags:(ephemeral?MessageFlags.Ephemeral:0)|MessageFlags.IsComponentsV2,components} as never;
  }
  const parts:unknown[]=[{type:10,content:`# ${title}\n`},{type:14,divider:true,spacing:2},{type:10,content:description}];
  const image=replace(String(definition.image_url??""),values); if(image) parts.push({type:12,items:[{media:{url:image}}]});
  if(row) parts.push(row.toJSON());
  return {flags:(ephemeral?MessageFlags.Ephemeral:0)|MessageFlags.IsComponentsV2,components:[{type:17,components:parts}]} as never;
}

function normalizeComponentColors(value:unknown):unknown[] {
  if(!Array.isArray(value))return [];
  return value.map((item)=>{
    if(!isRecord(item))return item;
    const next={...item};
    if(next.type===17&&typeof next.accent_color==="string"&&/^#[0-9a-f]{6}$/i.test(next.accent_color))next.accent_color=Number.parseInt(next.accent_color.slice(1),16);
    if(Array.isArray(next.components))next.components=normalizeComponentColors(next.components);
    return next;
  });
}

function modal(id:string,title:string,inputId:string,label:string,style:TextInputStyle) {
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId(inputId).setLabel(label).setStyle(style).setRequired(true)));
}
function promptPayModal(context:FeatureContext){const minimum=money(numberConfig(context.config.MIN_TOPUP_SATANG,1000));return new ModalBuilder().setCustomId("wallet:promptpay").setTitle("เติมเงินพร้อมเพย์").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("amount").setLabel(`จำนวนเงิน (ขั้นต่ำ ${minimum} บาท)`).setPlaceholder(`กรอกตัวเลข เช่น ${minimum}`).setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(12).setRequired(true)));}
function vars(context:FeatureContext,userId:string) { const percent=numberConfig(context.config.TRUEMONEY_FEE_PERCENT,0),mode=stringConfig(context.config.TRUEMONEY_FEE_MODE,"FIXED");return {member_mention:`<@${userId}>`,member_avatar_url:"",currency:"THB",truemoney_fee:mode==="PERCENT"?`${percent}%`:money(numberConfig(context.config.TRUEMONEY_FEE_SATANG,500)),truemoney_fee_mode:mode,minimum_amount:money(numberConfig(context.config.MIN_TOPUP_SATANG,1000))}; }
function successVars(userId:string,r:WalletTopupResult,actor="ระบบ",operation="เติมเงิน",reason="-") { return {member_mention:`<@${userId}>`,amount:money(r.creditedSatang),balance:money(r.balanceSatang),currency:r.currency,payment_method:r.method==="SLIPOK"?"QR (SlipOK)":"TrueMoney Voucher",transaction_time:new Date(r.completedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}),actor_mention:actor,operation,reason}; }
function adjustmentVars(userId:string,actorId:string,r:WalletAdjustmentResult,reason:string){return {member_mention:`<@${userId}>`,actor_mention:`<@${actorId}>`,amount:money(Math.abs(r.adjustmentSatang)),balance:money(r.balanceSatang),currency:r.currency,payment_method:"ปรับยอดโดยผู้ดูแล",transaction_time:new Date(r.completedAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}),operation:operationLabel(r.operation),reason};}
function operationLabel(v:WalletAdjustmentOperation){return v==="ADD"?"เพิ่มเงิน":v==="REMOVE"?"ลบเงิน":"ตั้งยอดเงิน";}
function parseAmount(v:string){const normalized=v.trim();if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))throw new Error("กรุณากรอกจำนวนเงินเป็นตัวเลข และมีทศนิยมได้ไม่เกิน 2 ตำแหน่ง");const [baht,decimal=""]=normalized.split(".");const satang=Number(baht)*100+Number(decimal.padEnd(2,"0"));if(!Number.isSafeInteger(satang)||satang<=0)throw new Error("จำนวนเงินไม่ถูกต้อง");return satang;}
function money(v:number){return (v/100).toFixed(2);}
function replace(v:string,vars:Record<string,string>){return v.replace(/\{\{([a-z0-9_]+)}}/gi,(_,k:string)=>vars[k]??`{{${k}}}`);}
function deepRender(value:unknown,values:Record<string,string>):unknown {
  if(typeof value==="string")return replace(value,values);
  if(Array.isArray(value))return value.map((item)=>deepRender(item,values));
  if(isRecord(value)){
    if(typeof value.action==="string"&&value.action in ACTIONS){
      const action=ACTIONS[value.action as keyof typeof ACTIONS];
      return {type:2,style:action.style,label:action.label,emoji:{name:action.emoji},custom_id:action.id};
    }
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,deepRender(item,values)]));
  }
  return value;
}
function urlObject(url:string){return url?{url}:undefined;}
function optionalText(value:unknown,values:Record<string,string>){const rendered=replace(String(value??""),values);return rendered||undefined;}
function embedAuthor(value:unknown,values:Record<string,string>){if(!isRecord(value))return undefined;const name=optionalText(value.name,values);if(!name)return undefined;return{name,url:optionalText(value.url,values),icon_url:optionalText(value.icon_url,values)};}
function embedFooter(value:unknown,values:Record<string,string>){const footer=isRecord(value)?value:{text:value};const text=optionalText(footer.text,values);if(!text)return undefined;return{text,icon_url:optionalText(footer.icon_url,values)};}
function embedTimestamp(value:unknown){if(value===true)return new Date().toISOString();if(typeof value!=="string"||!value.trim())return undefined;const parsed=Date.parse(value);return Number.isNaN(parsed)?undefined:new Date(parsed).toISOString();}
function embedColor(value:unknown){if(typeof value==="number"&&Number.isInteger(value)&&value>=0&&value<=0xFFFFFF)return value;if(typeof value!=="string")return undefined;const normalized=value.trim().replace(/^#/,"");return /^[0-9a-f]{6}$/i.test(normalized)?Number.parseInt(normalized,16):undefined;}
function buttonStyle(value:unknown,fallback:ButtonStyle){const styles:Record<string,ButtonStyle>={primary:ButtonStyle.Primary,secondary:ButtonStyle.Secondary,success:ButtonStyle.Success,danger:ButtonStyle.Danger};return typeof value==="string"?styles[value.toLowerCase()]??fallback:fallback;}
function stringConfig(v:unknown,f:string){return typeof v==="string"&&v?v:f;}
function numberConfig(v:unknown,f:number){return typeof v==="number"&&Number.isSafeInteger(v)?v:f;}
function isRecord(v:unknown):v is Record<string,unknown>{return typeof v==="object"&&v!==null&&!Array.isArray(v);}
async function respondError(context:FeatureContext,interaction:Interaction,error:unknown){console.error(`Wallet Top-up failed for ${context.botId}:`,error);const failure=humanWalletError(error);const payload=render(context,"failed",{failure_reason:failure.message,failure_code:failure.code},true);if(interaction.isRepliable()){if(interaction.deferred||interaction.replied)await interaction.editReply(payload).catch(()=>undefined);else await interaction.reply(payload).catch(()=>undefined);}}
type PendingSession={sessionId:string;expiresAt:string;grantedRole?:boolean};
function readPendingSessions(value:unknown){const map=new Map<string,PendingSession>();if(!isRecord(value))return map;for(const [user,item] of Object.entries(value)){if(isRecord(item)&&typeof item.sessionId==="string"&&typeof item.expiresAt==="string")map.set(user,{sessionId:item.sessionId,expiresAt:item.expiresAt,...(typeof item.grantedRole==="boolean"?{grantedRole:item.grantedRole}:{})});}return map;}
async function savePending(context:FeatureContext,pending:Map<string,PendingSession>){await context.saveRuntimeState({...context.runtimeState,walletPendingSessions:Object.fromEntries(pending)});}
async function respondMessageError(context:FeatureContext,message:Message,error:unknown){console.error(`Wallet slip failed for ${context.botId}:`,error);const failure=humanWalletError(error);await message.reply(render(context,"failed",{failure_reason:failure.message,failure_code:failure.code},false)).catch(()=>undefined);}
function slipChannelUrl(context:FeatureContext){const channelId=stringConfig(context.config.SLIP_CHANNEL_ID,"");return context.guildId&&channelId?`https://discord.com/channels/${context.guildId}/${channelId}`:"";}
function formatRemaining(expiresAt:string){const seconds=Math.max(0,Math.ceil((Date.parse(expiresAt)-Date.now())/1000));return `${Math.floor(seconds/60)} นาที ${String(seconds%60).padStart(2,"0")} วินาที`;}
function clearCountdown(countdowns:Map<string,ReturnType<typeof setInterval>>,userId:string){const timer=countdowns.get(userId);if(timer)clearInterval(timer);countdowns.delete(userId);}
function startCountdown(context:FeatureContext,pending:Map<string,PendingSession>,countdowns:Map<string,ReturnType<typeof setInterval>>,interaction:Extract<Interaction,{editReply:unknown}>,expiresAt:string,sessionId:string,base:Record<string,string>){
  clearCountdown(countdowns,interaction.user.id);
  const timer=setInterval(()=>void(async()=>{
    const remaining=Date.parse(expiresAt)-Date.now();
    if(remaining<=0){clearCountdown(countdowns,interaction.user.id);const session=pending.get(interaction.user.id);await removeTemporarySlipRole(context,interaction.guild,interaction.user.id);pending.delete(interaction.user.id);await savePending(context,pending);await interaction.editReply(render(context,"expired",{session_id:session?.sessionId??sessionId},true)).catch(()=>undefined);return;}
    await interaction.editReply(render(context,"promptpay_qr",{...base,remaining_time:formatRemaining(expiresAt)},true)).catch(()=>undefined);
  })().catch((error)=>{console.error(`Wallet countdown failed for ${context.botId}:`,error);clearCountdown(countdowns,interaction.user.id);}),1_000);
  countdowns.set(interaction.user.id,timer);
}

async function grantTemporarySlipRole(context:FeatureContext,guild:ChatInputCommandInteraction["guild"],userId:string){const roleId=stringConfig(context.config.SLIP_SUBMITTER_ROLE_ID,"");if(!guild||!roleId)return false;const member=await guild.members.fetch(userId);if(member.roles.cache.has(roleId))return false;await member.roles.add(roleId,"Temporary wallet slip access");return true;}
async function removeTemporarySlipRole(context:FeatureContext,guild:Message["guild"]|ChatInputCommandInteraction["guild"],userId:string){const roleId=stringConfig(context.config.SLIP_SUBMITTER_ROLE_ID,"");if(!guild||!roleId)return;const member=await guild.members.fetch(userId).catch(()=>null);if(member?.roles.cache.has(roleId))await member.roles.remove(roleId,"Wallet slip window ended").catch(()=>undefined);}
async function cleanupExpiredSessions(context:FeatureContext,pending:Map<string,PendingSession>,countdowns:Map<string,ReturnType<typeof setInterval>>){const expired=[...pending.entries()].filter(([,session])=>Date.parse(session.expiresAt)<=Date.now());if(!expired.length)return;const guild=context.guildId?await context.client.guilds.fetch(context.guildId).catch(()=>null):null;for(const [userId] of expired){clearCountdown(countdowns,userId);await removeTemporarySlipRole(context,guild,userId);pending.delete(userId);}await savePending(context,pending);}
async function grantPermanentTopupRole(context:FeatureContext,guild:Message["guild"]|ChatInputCommandInteraction["guild"],userId:string){const roleId=stringConfig(context.config.TOPUP_MEMBER_ROLE_ID,"");if(!guild||!roleId)return;const member=await guild.members.fetch(userId).catch(()=>null);if(member&&!member.roles.cache.has(roleId))await member.roles.add(roleId,"Successful wallet top-up").catch(()=>undefined);}

async function walletHistory(context:FeatureContext,interaction:ChatInputCommandInteraction){if(!interaction.inGuild()||!(await isWalletAdmin(context,interaction)))return interaction.reply({content:"คุณไม่มีสิทธิ์ดูประวัติกระเป๋าเงิน",flags:MessageFlags.Ephemeral});const member=interaction.options.getUser("member",true);const limit=interaction.options.getInteger("limit")??numberConfig(context.config.WALLET_HISTORY_DEFAULT_LIMIT,10);await interaction.deferReply({flags:MessageFlags.Ephemeral});const history=await context.wallet.history(member.id,limit);const lines=history.entries.map((e,i)=>`${i+1}. ${e.amountSatang>=0?"+":""}${money(e.amountSatang)} THB · ${e.kind}${e.method?`/${e.method}`:""} · ${new Date(e.createdAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})}`).join("\n")||"ไม่พบประวัติ";const total=history.entries.reduce((sum,e)=>sum+e.amountSatang,0);return interaction.editReply(render(context,"history",{member_mention:`<@${member.id}>`,entry_count:String(history.entries.length),history_lines:lines,total:money(total),currency:history.currency},true));}
async function monthlySummary(context:FeatureContext,interaction:ChatInputCommandInteraction){if(!interaction.inGuild()||!(await isWalletAdmin(context,interaction)))return interaction.reply({content:"คุณไม่มีสิทธิ์ดูสรุปยอดเติมเงิน",flags:MessageFlags.Ephemeral});const member=interaction.options.getUser("member");await interaction.deferReply({flags:MessageFlags.Ephemeral});const result=await context.wallet.monthlySummary(member?.id);return interaction.editReply(render(context,"monthly_summary",{member_mention:member?`<@${member.id}>`:"ทั้งร้าน",amount:money(result.totalSatang),entry_count:String(result.entryCount),member_count:String(result.memberCount),currency:result.currency},true));}
async function topSpenders(context:FeatureContext,interaction:ChatInputCommandInteraction){if(!interaction.inGuild()||!(await isWalletAdmin(context,interaction)))return interaction.reply({content:"คุณไม่มีสิทธิ์อัปเดตอันดับ",flags:MessageFlags.Ephemeral});await interaction.deferReply({flags:MessageFlags.Ephemeral});const board=await context.wallet.leaderboard(50);const sync=await syncTopSpenderRoles(context,interaction.guild,board);const lines=board.entries.slice(0,10).map((e,i)=>`${i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`} <@${e.memberDiscordId}> — **${money(e.totalTopupSatang)}** THB`).join("\n")||"ยังไม่มีข้อมูล";const payload=render(context,"leaderboard",{leaderboard_lines:lines,updated_count:String(sync.updated),error_lines:sync.errors.slice(0,5).join("\n")},false);await interaction.editReply(payload);const channelId=stringConfig(context.config.TOP_SPENDER_LEADERBOARD_CHANNEL_ID,"");if(channelId){const channel=await context.client.channels.fetch(channelId);if(channel?.isTextBased()&&channel.isSendable())await channel.send(payload);}}

async function syncTopSpenderRoles(context:FeatureContext,guild:Message["guild"]|ChatInputCommandInteraction["guild"],provided?:Awaited<ReturnType<FeatureContext["wallet"]["leaderboard"]>>){if(!guild)return{updated:0,errors:[] as string[]};const top1=stringConfig(context.config.TOP_SPENDER_TOP1_ROLE_ID,""),top10=stringConfig(context.config.TOP_SPENDER_TOP10_ROLE_ID,"");const milestones=parseMilestones(context.config.TOP_SPENDER_MILESTONE_ROLES);if(!top1&&!top10&&!milestones.length)return{updated:0,errors:[] as string[]};const board=provided??await context.wallet.leaderboard(50);let updated=0;const errors:string[]=[];for(const [index,entry] of board.entries.entries()){const desired=new Set<string>();if(index===0&&top1)desired.add(top1);if(index<10&&top10)desired.add(top10);for(const m of milestones)if(entry.totalTopupSatang>=m.thresholdSatang)desired.add(m.roleId);const member=await guild.members.fetch(entry.memberDiscordId).catch(()=>null);if(!member)continue;const managed=[top1,top10,...milestones.map((m)=>m.roleId)].filter(Boolean);const add=[...desired].filter((id)=>!member.roles.cache.has(id));const remove=managed.filter((id)=>member.roles.cache.has(id)&&!desired.has(id));try{if(add.length)await member.roles.add(add,"Wallet top spender sync");if(remove.length)await member.roles.remove(remove,"Wallet top spender sync");if(add.length||remove.length)updated++;}catch(error){errors.push(`<@${entry.memberDiscordId}>: ${error instanceof Error?error.message:"role update failed"}`);}}return{updated,errors};}
function parseMilestones(value:unknown){if(!Array.isArray(value))return[];return value.flatMap((item)=>{if(!isRecord(item))return[];const threshold=Number(item.thresholdBaht??item.threshold),roleId=String(item.roleId??"");return Number.isFinite(threshold)&&threshold>0&&/^\d{15,30}$/.test(roleId)?[{thresholdSatang:Math.round(threshold*100),roleId}]:[];});}
const WALLET_ERRORS:Record<string,string>={
  VOUCHER_ALREADY_USED:"ซอง TrueMoney นี้ถูกใช้หรือกำลังถูกประมวลผลแล้ว กรุณาสร้างซองใหม่",
  REDEMPTION_OUTCOME_UNKNOWN:"TrueMoney อาจรับซองแล้ว แต่ระบบยืนยันผลไม่ได้ กรุณาอย่าส่งซ้ำและติดต่อผู้ดูแลร้านเพื่อตรวจสอบยอด",
  SLIPOK_1005:"รองรับเฉพาะรูปสลิป JPG, JPEG และ PNG",
  SLIPOK_1006:"ไฟล์รูปภาพไม่ถูกต้อง กรุณาส่งรูปสลิปใหม่",
  SLIPOK_1007:"ไม่พบ QR สำหรับตรวจสอบในรูป กรุณาครอปให้เห็น QR ชัดเจนแล้วส่งใหม่",
  SLIPOK_1008:"QR ในรูปนี้ไม่ใช่ QR สำหรับตรวจสอบการชำระเงิน",
  SLIPOK_1009:"ระบบธนาคารขัดข้องชั่วคราว กรุณาลองส่งใหม่ภายหลัง",
  SLIPOK_1010:"ธนาคารกำลังประมวลผลสลิป กรุณารอ 1–2 นาทีแล้วส่งใหม่",
  SLIPOK_1011:"QR ในสลิปหมดอายุหรือไม่พบรายการชำระเงิน",
  SLIPOK_1012:"สลิปนี้ถูกใช้เติมเงินไปแล้ว ไม่สามารถใช้ซ้ำได้",
  SLIPOK_1013:"ยอดเงินในสลิปไม่ตรงกับยอด QR ที่สร้างไว้",
  SLIPOK_1014:"บัญชีผู้รับในสลิปไม่ตรงกับบัญชีที่ร้านลงทะเบียนไว้",
  SESSION_EXPIRED:"รายการเติมเงินหมดเวลาแล้ว กรุณาสร้าง QR ใหม่",
  BELOW_MINIMUM:"จำนวนเงินต่ำกว่ายอดเติมขั้นต่ำของร้าน",
  SLIPOK_NOT_CONFIGURED:"ร้านยังตั้งค่าระบบตรวจสลิปไม่ครบ",
  PROMPTPAY_NOT_CONFIGURED:"ร้านยังตั้งค่าพร้อมเพย์ไม่ครบ",
};
function humanWalletError(error:unknown){if(error instanceof RuntimeApiError)return{code:error.code,message:WALLET_ERRORS[error.code]??error.message};return{code:"RUNTIME_ERROR",message:error instanceof Error?error.message.slice(0,300):"ระบบเกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"};}
