import {
  ActionRowBuilder,ButtonBuilder,ButtonStyle,EmbedBuilder,Interaction,MessageFlags,ModalBuilder,
  PermissionFlagsBits,SlashCommandBuilder,StringSelectMenuBuilder,StringSelectMenuOptionBuilder,
  TextInputBuilder,TextInputStyle,type ButtonInteraction,type ChatInputCommandInteraction,type Message,type ModalSubmitInteraction,
} from "discord.js";
import type { FeatureContext,FeatureModule,RobuxPayoutJob } from "../../types.js";
import { eligibility,groupFunds,groupMembership,payout,userAvatar,type RobloxGroup,type RobloxFailure } from "./roblox-client.js";

const ID={buy:"fujipp:robux:buy",group:"fujipp:robux:group",user:"fujipp:robux:user",pkg:"fujipp:robux:pkg",confirm:"fujipp:robux:confirm",cancel:"fujipp:robux:cancel",membership:"fujipp:robux:membership",membershipGroup:"fujipp:robux:membership-group",membershipUser:"fujipp:robux:membership-user"};
const RELOAD_GROUPS="__reload__";
const PANEL_REFRESH_MS=60_000;

export const robloxRobuxPayoutFeature=createRobloxRobuxPayoutFeature("1.0.0",false);

export function createRobloxRobuxPayoutFeature(version:string,membershipEnabled:boolean,purchaseUsernameMaxLength=20,purchaseModalTitle="เช็คสิทธิ์รับ Robux"):FeatureModule{return {
  runtimeKey:"roblox-robux-payout",version,intents:["Guilds"],
  async activate(context){
    const pending=new Map<string,PendingPurchase>();
    const groups=readGroups(context); const command=stringConfig(context.config.PANEL_COMMAND_NAME,"robux-panel");
    const queue=new PayoutQueue(context,groups);
    const panels=new PanelUpdater(context,groups,membershipEnabled);
    const listener=(interaction:Interaction)=>void handle(context,groups,queue,panels,pending,command,membershipEnabled,purchaseUsernameMaxLength,purchaseModalTitle,interaction).catch((error)=>respondError(context,interaction,error));
    context.client.on("interactionCreate",listener);
    context.client.once("clientReady",()=>void onReady(context,groups,queue,panels,command).catch((error)=>{console.error(`Robux Payout startup failed for ${context.botId}:`,error);void context.reportFeatureError("FEATURE_STARTUP_FAILED",error);}));
    return()=>{context.client.off("interactionCreate",listener);queue.stop();panels.stop();pending.clear();};
  },
};}

async function onReady(context:FeatureContext,groups:RobloxGroup[],queue:PayoutQueue,panels:PanelUpdater,command:string){
  await context.client.application?.commands.create(new SlashCommandBuilder().setName(command).setDescription("ส่ง Panel ร้าน Robux").toJSON());
  await panels.restore();
  const recovery=await context.robux.recoverable();
  for(const job of recovery.jobs){
    if(job.status==="PROCESSING")await context.robux.outcome(job.jobId,{status:"REVIEW_REQUIRED",result:{},errorCode:"RUNNER_RESTARTED",errorMessage:"Runner restarted while Roblox payout outcome was unknown"});
    else queue.add(job);
  }
  console.info(`Roblox Robux Payout active: bot ${context.botId}`);
}

async function handle(context:FeatureContext,groups:RobloxGroup[],queue:PayoutQueue,panels:PanelUpdater,pending:Map<string,PendingPurchase>,command:string,membershipEnabled:boolean,purchaseUsernameMaxLength:number,purchaseModalTitle:string,interaction:Interaction){
  if(interaction.isChatInputCommand()&&interaction.commandName===command)return postPanel(context,groups,panels,membershipEnabled,interaction);
  if(membershipEnabled&&interaction.isButton()&&interaction.customId===ID.membership)return startMembershipCheck(groups,interaction);
  if(membershipEnabled&&interaction.isStringSelectMenu()&&interaction.customId===ID.membershipGroup)return showMembershipModal(groups,interaction.values[0]!,interaction);
  if(membershipEnabled&&interaction.isModalSubmit()&&interaction.customId.startsWith(`${ID.membershipUser}:`))return checkMembership(context,groups,interaction.customId.slice(ID.membershipUser.length+1),interaction);
  if(interaction.isButton()&&interaction.customId===ID.buy)return startBuy(context,groups,purchaseUsernameMaxLength,purchaseModalTitle,interaction);
  if(interaction.isStringSelectMenu()&&interaction.customId===ID.group){const selected=interaction.values[0]!;if(selected===RELOAD_GROUPS){await panels.set(interaction.message);return interaction.update(await buildPanelPayload(context,groups,membershipEnabled) as never);}return showUsernameModal(groups,selected,purchaseUsernameMaxLength,purchaseModalTitle,interaction);}
  if(interaction.isModalSubmit()&&interaction.customId.startsWith(`${ID.user}:`))return checkUser(context,groups,pending,interaction.customId.slice(ID.user.length+1),interaction);
  if(interaction.isStringSelectMenu()&&interaction.customId.startsWith(`${ID.pkg}:`))return selectPackage(context,pending,interaction.customId.slice(ID.pkg.length+1),interaction.values[0]!,interaction);
  if(interaction.isButton()&&interaction.customId.startsWith(`${ID.confirm}:`))return confirm(context,groups,queue,pending,interaction.customId.slice(ID.confirm.length+1),interaction);
  if(interaction.isButton()&&interaction.customId.startsWith(`${ID.cancel}:`)){const purchase=pending.get(interaction.customId.slice(ID.cancel.length+1));pending.delete(interaction.customId.slice(ID.cancel.length+1));return interaction.update(render(context,"failed",{reason:"ยกเลิกการซื้อ Robux แล้ว",username:purchase?.robloxUsername??"-",datetime:dateTime(),avatar:interaction.user.displayAvatarURL()},[]));}
}

async function postPanel(context:FeatureContext,groups:RobloxGroup[],panels:PanelUpdater,membershipEnabled:boolean,interaction:ChatInputCommandInteraction){
  if(!interaction.inGuild())return;
  if(!context.permissions.canUse(interaction,interaction.commandName,false))return interaction.reply({content:"คุณไม่มีสิทธิ์ใช้คำสั่งนี้",flags:MessageFlags.Ephemeral});
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  if(!interaction.channel?.isSendable())throw new Error("Channel cannot send messages");
  const payload=await buildPanelPayload(context,groups,membershipEnabled);
  const existing=panels.current();
  if(existing)await existing.delete().catch(()=>undefined);
  const message=await interaction.channel.send(payload as never);
  await panels.set(message);
  return interaction.editReply("ส่ง Panel ร้าน Robux เรียบร้อย");
}

async function buildPanelPayload(context:FeatureContext,groups:RobloxGroup[],membershipEnabled=false){
  const stock=await Promise.all(groups.map(async(group)=>{const result=await groupFunds(group);return {group,value:result.ok?result.robux:null};}));
  const rows=panelActionRows(context,stock,membershipEnabled);
  const stockLines=stock.map(({group,value})=>`**${group.name}** [เข้ากลุ่ม](https://www.roblox.com/communities/${group.groupId})\nยอดคงเหลือ ${value?.toLocaleString()??"—"}`).join("\n\n")||"ยังไม่ได้ตั้งค่า Roblox Group";
  const payload=render(context,"panel",{stock_lines:stockLines},rows);
  if(!Array.isArray(payload.embeds))return payload;
  payload.embeds[0]?.setFields(stock.slice(0,24).map(({group,value})=>({name:group.name.slice(0,256),value:`\`\`\`${value?.toLocaleString()??"—"}\`\`\`[เข้ากลุ่ม](https://www.roblox.com/communities/${group.groupId})`,inline:true})));
  return payload;
}

function panelActionRows(context:FeatureContext,stock:Array<{group:RobloxGroup;value:number|null}>,membershipEnabled:boolean){
  const rows:Array<ActionRowBuilder<ButtonBuilder>|ActionRowBuilder<StringSelectMenuBuilder>>=[];const role=componentConfig(context,"panel","group_select");
  const options=stock.slice(0,24).map(({group,value},index)=>new StringSelectMenuOptionBuilder().setLabel(group.name.slice(0,100)).setValue(group.key).setDescription(`ยอดคงเหลือ ${value?.toLocaleString()??"—"}`.slice(0,100)).setEmoji(numberEmoji(index)));
  options.push(new StringSelectMenuOptionBuilder().setLabel("รีโหลดตัวเลือก").setValue(RELOAD_GROUPS).setEmoji("🔄"));
  const select=new StringSelectMenuBuilder().setCustomId(ID.group).setPlaceholder(String(role.placeholder??"เลือกกลุ่มที่ต้องการซื้อ").slice(0,150)).addOptions(options);
  rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  if(membershipEnabled)rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(styledButton(context,"panel","btn_membership",ID.membership,"เช็กวันที่เข้ากลุ่ม",ButtonStyle.Primary)));
  if(context.installedFeatureCodes.has("wallet-topup")){
    const raw=(context.presentations.panel??{}) as Record<string,unknown>;
    const configured=Array.isArray(raw.co_features)?raw.co_features.filter(isRecord):[];
    const items=configured.length?configured:[
      {action:"wallet.topup",label:"เติมเงิน",emoji:"💰",style:"success"},
      {action:"wallet.balance",label:"เช็คยอดเงินคงเหลือ",emoji:"💳",style:"secondary"},
    ];
    const ids:Record<string,string>={"wallet.topup":"fujipp:wallet:topup","wallet.balance":"fujipp:wallet:balance"};
    const buttons=items.flatMap((item)=>{const id=ids[String(item.action??"")];return id?[configuredButton(item,id)]:[];});
    if(buttons.length)rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(0,5)));
  }
  return rows;
}

async function startMembershipCheck(groups:RobloxGroup[],interaction:ButtonInteraction){
  if(!groups.length)return interaction.reply({content:"ยังไม่ได้ตั้งค่า Roblox Group",flags:MessageFlags.Ephemeral});
  if(groups.length===1)return showMembershipModal(groups,groups[0]!.key,interaction);
  const menu=new StringSelectMenuBuilder().setCustomId(ID.membershipGroup).setPlaceholder("เลือกกลุ่มที่ต้องการตรวจสอบ").addOptions(groups.slice(0,25).map((group)=>new StringSelectMenuOptionBuilder().setLabel(group.name.slice(0,100)).setValue(group.key)));
  return interaction.reply({content:"เลือกกลุ่ม Roblox",components:[new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],flags:MessageFlags.Ephemeral});
}

async function showMembershipModal(groups:RobloxGroup[],key:string,interaction:ButtonInteraction|import("discord.js").StringSelectMenuInteraction){
  const group=groups.find((item)=>item.key===key);if(!group)throw new Error("ไม่พบกลุ่ม Roblox");
  const modal=new ModalBuilder().setCustomId(`${ID.membershipUser}:${key}`).setTitle(`เช็กวันที่เข้ากลุ่ม (${group.name})`.slice(0,45));
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("username").setLabel("Username Roblox").setPlaceholder("เช่น builderman").setMinLength(3).setMaxLength(20).setRequired(true).setStyle(TextInputStyle.Short)));
  return interaction.showModal(modal);
}

async function checkMembership(context:FeatureContext,groups:RobloxGroup[],key:string,interaction:ModalSubmitInteraction){
  const group=groups.find((item)=>item.key===key);if(!group)throw new Error("ไม่พบกลุ่ม Roblox");
  const apiKey=stringConfig(group.openCloudApiKey,"");if(!apiKey)throw new Error(`กลุ่ม ${group.name} ยังไม่ได้ตั้งค่า Roblox Open Cloud API Key`);
  const username=interaction.fields.getTextInputValue("username").trim();
  await interaction.deferReply({flags:MessageFlags.Ephemeral});
  const membership=await groupMembership(username,group.groupId,apiKey);
  if(!membership.ok)throw new Error(humanRobloxError(membership.error));
  if(!membership.isMember||!membership.createTime)throw new Error(`บัญชี ${membership.username} ยังไม่ได้อยู่ในกลุ่ม ${group.name}`);
  const joinedAt=new Date(membership.createTime);const days=Math.max(0,Math.floor((Date.now()-joinedAt.getTime())/86_400_000));
  const avatar=await userAvatar(membership.userId);
  return interaction.editReply(render(context,"membership_result",{roblox_username:membership.username,roblox_id:String(membership.userId),group_name:group.name,group_id:String(group.groupId),joined_date:new Intl.DateTimeFormat("th-TH",{dateStyle:"long",timeZone:"Asia/Bangkok"}).format(joinedAt),days_in_group:days.toLocaleString("th-TH"),avatar},[]));
}

function numberEmoji(index:number){return ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"][index]??"🎮";}

async function startBuy(context:FeatureContext,groups:RobloxGroup[],purchaseUsernameMaxLength:number,purchaseModalTitle:string,interaction:ButtonInteraction){
  if(!groups.length)return interaction.reply({content:"ยังไม่ได้ตั้งค่า Roblox Group และ Credentials สำหรับ Feature นี้",flags:MessageFlags.Ephemeral});
  if(!boolConfig(context.config.ROBUX_ENABLED,true))return interaction.reply({content:"ระบบขาย Robux ปิดให้บริการชั่วคราว",flags:MessageFlags.Ephemeral});
  if(groups.length===1)return showUsernameModal(groups,groups[0]!.key,purchaseUsernameMaxLength,purchaseModalTitle,interaction);
  const role=componentConfig(context,"panel","group_select");const menu=new StringSelectMenuBuilder().setCustomId(ID.group).setPlaceholder(String(role.placeholder??"เลือกกลุ่ม Roblox").slice(0,150)).addOptions(groups.slice(0,25).map((g)=>new StringSelectMenuOptionBuilder().setLabel(g.name.slice(0,100)).setValue(g.key)));
  return interaction.reply({content:"เลือกกลุ่มที่ต้องการรับ Robux",components:[new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],flags:MessageFlags.Ephemeral});
}

async function showUsernameModal(groups:RobloxGroup[],key:string,maxLength:number,title:string,interaction:ButtonInteraction|import("discord.js").StringSelectMenuInteraction){
  const group=groups.find((item)=>item.key===key);if(!group)throw new Error("ไม่พบกลุ่ม Roblox");
  return interaction.showModal(buildPurchaseUsernameModal(group,maxLength,title));
}

export function buildPurchaseUsernameModal(group:Pick<RobloxGroup,"key"|"name">,maxLength:number,title:string){
  const modal=new ModalBuilder().setCustomId(`${ID.user}:${group.key}`).setTitle(`${title} (${group.name})`.slice(0,45));
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("username").setLabel("Username Roblox").setPlaceholder("เช่น builderman").setMinLength(3).setMaxLength(maxLength).setRequired(true).setStyle(TextInputStyle.Short)));
  return modal;
}

async function checkUser(context:FeatureContext,groups:RobloxGroup[],pending:Map<string,PendingPurchase>,key:string,interaction:ModalSubmitInteraction){
  const group=groups.find((item)=>item.key===key);if(!group)throw new Error("ไม่พบกลุ่ม Roblox");
  const username=interaction.fields.getTextInputValue("username").trim();
  const processing=render(context,"processing",{detail:"กรุณารอสักครู่",avatar:interaction.user.displayAvatarURL(),roblox_username:username,robux:"-"},[]);
  await interaction.reply({...processing,flags:MessageFlags.Ephemeral|("flags" in processing?processing.flags:0)});
  const [check,stock,balance]=await Promise.all([eligibility(username,group),groupFunds(group),context.wallet.balance(interaction.user.id)]);
  if(!check.ok)throw new Error(humanRobloxError(check.error));
  if(!check.eligible)throw new Error("บัญชีนี้ยังไม่มีสิทธิ์รับ Group Payout กรุณาเข้ากลุ่มและรอให้ Roblox อนุมัติสิทธิ์ก่อน");
  if(!stock.ok)throw new Error(humanRobloxError(stock.error));
  const packages=readPackages(context).filter((item)=>item.robux<=stock.robux);
  if(!packages.length)throw new Error("Robux ในกลุ่มไม่เพียงพอสำหรับ Package พื้นฐาน");
  const id=interaction.id;pending.set(id,{memberId:interaction.user.id,groupKey:key,groupName:group.name,robloxUserId:check.userId,robloxUsername:check.username,packages,expiresAt:Date.now()+300_000});
  const role=componentConfig(context,"package_selector","pkg_select");const menu=new StringSelectMenuBuilder().setCustomId(`${ID.pkg}:${id}`).setPlaceholder(String(role.placeholder??"🎮 เลือก Robux Package").slice(0,150)).addOptions(packages.slice(0,25).map((item)=>new StringSelectMenuOptionBuilder().setLabel(`${item.robux.toLocaleString()} Robux (${money(item.priceSatang)} บาท)`.slice(0,100)).setDescription(balance.balanceSatang>=item.priceSatang?"✅":"❌ ยอดเงินไม่พอ").setValue(String(item.robux))));
  return interaction.editReply(render(context,"package_selector",{message:"ผู้ใช้มีสิทธิ์รับ Robux แล้ว",username:check.username,roblox_username:check.username,balance:money(balance.balanceSatang),rate:String(numberConfig(context.config.ROBUX_RATE,3.5)),group_robux:stock.robux.toLocaleString(),group_stock:String(stock.robux),group_name:group.name,avatar:interaction.user.displayAvatarURL(),currency:"THB"},[new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)]));
}

async function selectPackage(context:FeatureContext,pending:Map<string,PendingPurchase>,id:string,value:string,interaction:import("discord.js").StringSelectMenuInteraction){
  const purchase=pending.get(id);if(!purchase||purchase.memberId!==interaction.user.id||purchase.expiresAt<Date.now()){pending.delete(id);throw new Error("รายการหมดอายุ กรุณาเริ่มใหม่");}
  const selected=purchase.packages.find((item)=>item.robux===Number(value));if(!selected)throw new Error("ไม่พบแพ็กเกจ");purchase.selected=selected;
  const balance=await context.wallet.balance(interaction.user.id);
  if(balance.balanceSatang<selected.priceSatang)throw new Error("ยอดเงินไม่เพียงพอสำหรับ Package ที่เลือก");
  const rows=[new ActionRowBuilder<ButtonBuilder>().addComponents(styledButton(context,"confirmation","btn_confirm",`${ID.confirm}:${id}`,"ยืนยัน",ButtonStyle.Success),styledButton(context,"confirmation","btn_cancel",`${ID.cancel}:${id}`,"ยกเลิก",ButtonStyle.Danger))];
  return interaction.update(render(context,"confirmation",{roblox_id:String(purchase.robloxUserId),idRoblox:String(purchase.robloxUserId),roblox_username:purchase.robloxUsername,usernameRoblox:purchase.robloxUsername,robux:String(selected.robux),price:money(selected.priceSatang),balance_after:money(balance.balanceSatang-selected.priceSatang),group_name:purchase.groupName,avatar:interaction.user.displayAvatarURL(),currency:"THB"},rows));
}

async function confirm(context:FeatureContext,groups:RobloxGroup[],queue:PayoutQueue,pending:Map<string,PendingPurchase>,id:string,interaction:ButtonInteraction){
  const purchase=pending.get(id);if(!purchase||purchase.memberId!==interaction.user.id||!purchase.selected||purchase.expiresAt<Date.now()){pending.delete(id);throw new Error("รายการหมดอายุ กรุณาเริ่มใหม่");}
  pending.delete(id);await interaction.update(render(context,"processing",{detail:"กำลังตรวจสอบข้อมูล",avatar:interaction.user.displayAvatarURL(),roblox_username:purchase.robloxUsername,robux:String(purchase.selected.robux)},[]));
  const group=groups.find((item)=>item.key===purchase.groupKey);if(!group)throw new Error("ไม่พบกลุ่ม Roblox");
  const [check,stock]=await Promise.all([eligibility(purchase.robloxUsername,group),groupFunds(group)]);
  if(!check.ok||!check.eligible||check.userId!==purchase.robloxUserId)throw new Error("สิทธิ์รับ Robux เปลี่ยนแปลง กรุณาเริ่มใหม่");
  if(!stock.ok||stock.robux<purchase.selected.robux)throw new Error("Robux ในกลุ่มไม่เพียงพอ");
  const job=await context.robux.begin({memberDiscordId:interaction.user.id,robloxUserId:purchase.robloxUserId,robloxUsername:purchase.robloxUsername,groupKey:group.key,groupId:group.groupId,robuxAmount:purchase.selected.robux,priceSatang:purchase.selected.priceSatang,idempotencyKey:`discord:${interaction.id}`});
  queue.add(job,{interaction});await interaction.editReply(render(context,"queued",{queue:"1",robux:String(job.robuxAmount),price:money(job.priceSatang),balance:money(job.balanceSatang),avatar:interaction.user.displayAvatarURL()},[]));
}

class PayoutQueue{
  private items:Array<{job:RobuxPayoutJob;interaction?:ButtonInteraction}>=[];private running=false;private stopped=false;
  constructor(private context:FeatureContext,private groups:RobloxGroup[]){}
  add(job:RobuxPayoutJob,extra?:{interaction?:ButtonInteraction}){this.items.push({job,...extra});void this.run();}
  stop(){this.stopped=true;}
  private async run(){if(this.running)return;this.running=true;while(this.items.length&&!this.stopped){const item=this.items.shift()!;await this.process(item).catch(console.error);if(this.items.length)await new Promise((resolve)=>setTimeout(resolve,numberConfig(this.context.config.ROBUX_PAYOUT_COOLDOWN_SECONDS,30)*1000));}this.running=false;}
  private async process({job,interaction}: {job:RobuxPayoutJob;interaction?:ButtonInteraction}){
    const group=this.groups.find((item)=>item.key===job.groupKey&&item.groupId===job.groupId);
    if(!group){await this.context.robux.refund(job.jobId,{errorCode:"GROUP_NOT_CONFIGURED",errorMessage:"Configured Roblox group is no longer available"});return;}
    try{await this.context.robux.claim(job.jobId);}catch{return;}
    const result=await payout(group,job.robloxUserId,job.robuxAmount);
    if(!result.ok&&result.error.unknownOutcome){await this.context.robux.outcome(job.jobId,{status:"REVIEW_REQUIRED",result:{},errorCode:result.error.code,errorMessage:result.error.message});await this.notify(job,"REVIEW_REQUIRED",result.error.message);return;}
    if(!result.ok){const refund=await this.context.robux.refund(job.jobId,{errorCode:result.error.code,errorMessage:result.error.message});if(interaction)await interaction.editReply(render(this.context,"failed",{reason:humanRobloxError(result.error),failure_reason:humanRobloxError(result.error),username:job.robloxUsername,datetime:dateTime(),avatar:interaction.user.displayAvatarURL(),refund:money(job.priceSatang),balance:money(refund.balanceSatang),currency:"THB"},[])).catch(()=>undefined);await this.notify(job,"REFUNDED",result.error.message);return;}
    await this.context.robux.outcome(job.jobId,{status:"SUCCEEDED",result:result.data});const balance=await this.context.wallet.balance(job.memberDiscordId);
    if(interaction)await interaction.editReply(render(this.context,"succeeded",{member_mention:`<@${job.memberDiscordId}>`,roblox_id:String(job.robloxUserId),idRoblox:String(job.robloxUserId),roblox_username:job.robloxUsername,usernameRoblox:job.robloxUsername,robux:String(job.robuxAmount),price:money(job.priceSatang),balance:money(balance.balanceSatang),group_name:this.groups.find((group)=>group.key===job.groupKey)?.name??job.groupKey,datetime:dateTime(),avatar:interaction.user.displayAvatarURL(),currency:"THB"},[])).catch(()=>undefined);
    await this.notify(job,"SUCCEEDED","");
  }
  private async notify(job:RobuxPayoutJob,status:string,detail:string){const legacy=stringConfig(this.context.config.ROBUX_NOTIFICATION_CHANNEL_ID,"");const channelId=status==="SUCCEEDED"?stringConfig(this.context.config.ROBUX_SUCCESS_NOTIFICATION_CHANNEL_ID,legacy):stringConfig(this.context.config.ROBUX_ERROR_NOTIFICATION_CHANNEL_ID,legacy);if(!channelId)return;const channel=await this.context.client.channels.fetch(channelId).catch(()=>null);if(channel?.isTextBased()&&channel.isSendable()){const avatar=await userAvatar(job.robloxUserId);const slot=status==="SUCCEEDED"?"notification_success":"notification_error";const groupName=this.groups.find((group)=>group.key===job.groupKey&&group.groupId===job.groupId)?.name??job.groupKey;await channel.send(render(this.context,slot,{member_mention:`<@${job.memberDiscordId}>`,username:job.memberDiscordId,roblox_id:String(job.robloxUserId),idRoblox:String(job.robloxUserId),roblox_username:job.robloxUsername,usernameRoblox:job.robloxUsername,robux:String(job.robuxAmount),price:money(job.priceSatang),group_name:groupName,status,detail,error:detail,reason:detail,datetime:dateTime(),avatar,currency:"THB"},[]));}}
}

class PanelUpdater{
  private message:Message|null=null;
  private timer:ReturnType<typeof setInterval>;
  private refreshing=false;
  private stopped=false;
  constructor(private context:FeatureContext,private groups:RobloxGroup[],private membershipEnabled:boolean){
    this.timer=setInterval(()=>void this.refresh().catch((error)=>console.error(`Robux panel refresh failed for ${this.context.botId}:`,error)),PANEL_REFRESH_MS);
  }
  current(){return this.message;}
  async set(message:Message){
    if(this.stopped)return;
    this.message=message;
    await this.save({channelId:message.channelId,messageId:message.id});
  }
  async restore(){
    const value=this.context.runtimeState.robuxPanel;
    if(!value||typeof value!=="object")return;
    const ref=value as Record<string,unknown>;
    const channelId=String(ref.channelId??""),messageId=String(ref.messageId??"");
    if(!/^\d{15,30}$/.test(channelId)||!/^\d{15,30}$/.test(messageId))return;
    const channel=await this.context.client.channels.fetch(channelId).catch(()=>null);
    if(!channel?.isTextBased()){await this.remove();return;}
    const message=await channel.messages.fetch(messageId).catch(()=>null);
    if(!message){await this.remove();return;}
    this.message=message;
    await this.refresh();
  }
  stop(){this.stopped=true;clearInterval(this.timer);this.message=null;}
  private async refresh(){
    if(this.refreshing||this.stopped||!this.message)return;
    this.refreshing=true;
    try{
      const payload=await buildPanelPayload(this.context,this.groups,this.membershipEnabled);
      const id=this.message.id;
      const updated=await this.message.edit(payload as never).catch((error:unknown)=>{
        console.warn(`Unable to refresh Robux panel ${id}:`,error);
        return null;
      });
      if(!updated){
        await this.remove();
      }
    }finally{this.refreshing=false;}
  }
  private async remove(){this.message=null;await this.save(null);}
  private async save(robuxPanel:{channelId:string;messageId:string}|null){
    await this.context.saveRuntimeState({...this.context.runtimeState,robuxPanel});
  }
}

function render(context:FeatureContext,slot:string,values:Record<string,string>,components:Array<ActionRowBuilder<ButtonBuilder>|ActionRowBuilder<StringSelectMenuBuilder>>):any{
  const raw=(context.presentations[slot]??{}) as Record<string,unknown>;const fill=(value:unknown,fallback:string)=>String(value??fallback).replace(/\{\{?(\w+)\}?\}/g,(_,key:string)=>values[key]??"");
  const mode=String(raw.mode??"EMBED").toUpperCase();
  const nested=mode==="EMBED"&&isRecord(raw.embed)?raw.embed:mode==="COMPONENTS_V2"&&isRecord(raw.components_v2)?raw.components_v2:{};
  const definition={...raw,...nested};
  if(mode==="COMPONENTS_V2"){
    if(Array.isArray(definition.components)){
      const blocks=normalizeComponentColors(deepRender(definition.components,values));
      blocks.push(...components.map((row)=>row.toJSON()));
      return {flags:MessageFlags.IsComponentsV2,components:blocks};
    }
    const title=fill(definition.title,slot).slice(0,256);
    const description=fill(definition.description,"").slice(0,4000);
    const blocks:Array<Record<string,unknown>>=[];
    if(title)blocks.push({type:10,content:`# ${title}`});
    if(title&&description)blocks.push({type:14,spacing:1});
    if(description)blocks.push({type:10,content:description});
    if(components.length){blocks.push({type:14});blocks.push(...components.map((row)=>row.toJSON() as unknown as Record<string,unknown>));}
    return {flags:MessageFlags.IsComponentsV2,components:[{type:17,components:blocks}]};
  }
  const embed=new EmbedBuilder();
  const color=embedColor(definition.color);if(color!==undefined)embed.setColor(color);
  const title=fill(definition.title,slot).slice(0,256);const description=fill(definition.description,"").slice(0,4096);
  if(title)embed.setTitle(title);if(description)embed.setDescription(description);if(!title&&!description)embed.setDescription(slot);
  const url=fill(definition.url,"");if(title&&/^https:\/\//i.test(url))embed.setURL(url);
  const image=fill(presentationMediaUrl(definition,"image"),"");if(/^https?:\/\//i.test(image))embed.setImage(image);
  const thumbnail=fill(presentationMediaUrl(definition,"thumbnail"),"");if(/^https?:\/\//i.test(thumbnail))embed.setThumbnail(thumbnail);
  const footer=definition.footer as Record<string,unknown>|string|undefined;if(footer){const text=fill(typeof footer==="string"?footer:footer.text,"").slice(0,2048);const icon=fill(typeof footer==="object"?footer.icon_url:undefined,"");if(text)embed.setFooter({text,...(/^https?:\/\//i.test(icon)?{iconURL:icon}:{})});}
  const author=definition.author as Record<string,unknown>|undefined;if(author){const name=fill(author.name,"").slice(0,256),icon=fill(author.icon_url,""),authorUrl=fill(author.url,"");if(name)embed.setAuthor({name,...(/^https?:\/\//i.test(icon)?{iconURL:icon}:{}),...(/^https?:\/\//i.test(authorUrl)?{url:authorUrl}:{})});}
  if(Array.isArray(definition.fields)){const fields=definition.fields.filter((value):value is Record<string,unknown>=>Boolean(value&&typeof value==="object")).slice(0,25).map((field)=>({name:fill(field.name,"").slice(0,256),value:fill(field.value,"").slice(0,1024),inline:Boolean(field.inline)})).filter((field)=>field.name&&field.value);if(fields.length)embed.addFields(fields);}
  return {content:fill(definition.content,"")||undefined,embeds:[embed],components};
}

function deepRender(value:unknown,values:Record<string,string>):any{if(typeof value==="string")return value.replace(/\{\{?(\w+)\}?\}/g,(_,key:string)=>values[key]??"");if(Array.isArray(value))return value.map((item)=>deepRender(item,values));if(isRecord(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,deepRender(item,values)]));return value;}
function presentationMediaUrl(definition:Record<string,unknown>,key:"image"|"thumbnail"){
  const direct=String(definition[`${key}_url`]??"").trim();if(direct)return direct;
  const nested=definition[key];return isRecord(nested)?String(nested.url??"").trim():"";
}
function normalizeComponentColors(value:unknown):unknown[]{if(!Array.isArray(value))return[];return value.map((item)=>{if(!isRecord(item))return item;const next={...item};if(next.type===17&&typeof next.accent_color==="string"&&/^#[0-9a-f]{6}$/i.test(next.accent_color))next.accent_color=Number.parseInt(next.accent_color.slice(1),16);if(Array.isArray(next.components))next.components=normalizeComponentColors(next.components);return next;});}
function embedColor(value:unknown){if(typeof value==="number"&&Number.isInteger(value)&&value>=0&&value<=0xffffff)return value;if(typeof value!=="string")return undefined;const normalized=value.trim().replace(/^#/,"");return /^[0-9a-f]{6}$/i.test(normalized)?Number.parseInt(normalized,16):undefined;}

function componentConfig(context:FeatureContext,slot:string,role:string){const presentation=(context.presentations[slot]??{}) as Record<string,unknown>;const roles=presentation.components as Record<string,Record<string,unknown>>|undefined;return roles?.[role]??{};}
function styledButton(context:FeatureContext,slot:string,role:string,id:string,fallbackLabel:string,fallbackStyle:ButtonStyle){const cfg=componentConfig(context,slot,role);const styles:Record<string,ButtonStyle>={primary:ButtonStyle.Primary,secondary:ButtonStyle.Secondary,success:ButtonStyle.Success,danger:ButtonStyle.Danger};const button=new ButtonBuilder().setCustomId(id).setLabel(String(cfg.label??fallbackLabel).slice(0,80)).setStyle(styles[String(cfg.style??"").toLowerCase()]??fallbackStyle);const emoji=parseEmoji(String(cfg.emoji??""));if(emoji)try{button.setEmoji(emoji);}catch{/* invalid configured emoji */}return button;}
function configuredButton(cfg:Record<string,unknown>,id:string){const styles:Record<string,ButtonStyle>={primary:ButtonStyle.Primary,secondary:ButtonStyle.Secondary,success:ButtonStyle.Success,danger:ButtonStyle.Danger};const button=new ButtonBuilder().setCustomId(id).setLabel(String(cfg.label??"Action").slice(0,80)).setStyle(styles[String(cfg.style??"secondary").toLowerCase()]??ButtonStyle.Secondary);const emoji=parseEmoji(String(cfg.emoji??""));if(emoji)try{button.setEmoji(emoji);}catch{/* invalid configured emoji */}return button;}
function parseEmoji(value:string):string|{name:string;id:string;animated:boolean}|null{const raw=value.trim();if(!raw)return null;const match=raw.match(/^<(a)?:(\w+):(\d+)>$/);return match?{name:match[2]!,id:match[3]!,animated:Boolean(match[1])}:raw;}
function readGroups(context:FeatureContext):RobloxGroup[]{const definitions=arrayConfig(context.config.ROBLOX_GROUPS);let credentials:Record<string,{cookie?:string;totpSecret?:string;openCloudApiKey?:string}>={};try{credentials=JSON.parse(context.secrets.ROBLOX_CREDENTIALS??"{}") as typeof credentials;}catch{return [];}return definitions.map((item)=>{const row=item as Record<string,unknown>;const key=String(row.key??"");const credential=credentials[key]??{};return {key,name:String(row.name??key),groupId:Number(row.groupId),cookie:String(credential.cookie??""),...(credential.totpSecret?{totpSecret:String(credential.totpSecret)}:{}),...(credential.openCloudApiKey?{openCloudApiKey:String(credential.openCloudApiKey)}:{})};}).filter((g)=>/^[A-Za-z0-9_-]{1,40}$/.test(g.key)&&g.groupId>0&&g.cookie.length>20);}
function readPackages(context:FeatureContext):Package[]{
  const rate=numberConfig(context.config.ROBUX_RATE,3.5);
  const custom=arrayConfig(context.config.ROBUX_PACKAGES).map((item)=>{const row=item as Record<string,unknown>;const robux=Number(row.robux);return {robux,priceSatang:Math.ceil(robux/rate)*100};}).filter((item)=>Number.isInteger(item.robux)&&item.robux>0&&Number.isInteger(item.priceSatang)&&item.priceSatang>0).sort((a,b)=>a.robux-b.robux);
  if(custom.length)return custom;
  const legacy=rate===3.5?[[200,58],[300,86],[350,100],[400,115],[500,143],[600,172],[800,229],[1000,286],[1200,343],[1400,400],[1600,455],[2000,570],[3000,855],[4000,1140],[5000,1425],[7000,2000],[10000,2850],[20000,5700]]:rate===4?[[200,50],[300,75],[400,100],[500,125],[600,150],[800,200],[1200,300],[1400,350],[1600,400],[2000,500],[3000,750],[4000,1000],[5000,1250],[7000,1750],[10000,2500],[20000,4900]]:null;
  if(legacy)return legacy.map(([robux,baht])=>({robux:robux!,priceSatang:baht!*100}));
  return [200,300,400,500,600,800,1000,1200,1400,1600,2000,3000,4000,5000,7000,10000,20000].map((robux)=>({robux,priceSatang:Math.ceil(robux/rate)*100}));
}
function humanRobloxError(error:RobloxFailure){const labels:Record<string,string>={ROBLOX_INSUFFICIENT_FUNDS:"Robux ในกลุ่มไม่พอหรือ Roblox แจ้งยอดไม่เพียงพอ",ROBLOX_INSUFFICIENT_PERMISSIONS:"บัญชี Roblox ไม่มีสิทธิ์ payout ในกลุ่มนี้",ROBLOX_PAYOUT_RATE_LIMIT:"Roblox จำกัดความถี่การโอนชั่วคราว",ROBLOX_2FA_REQUIRED:"ยืนยัน 2FA ของ Roblox ไม่สำเร็จ",ROBLOX_SESSION_BLOCKED:"Roblox บล็อก Session นี้ชั่วคราว กรุณารอสักครู่หรือเข้าสู่ระบบใหม่",ROBLOX_CHALLENGE_CHEF:"Roblox ต้องการยืนยันตัวตน (Captcha) กรุณาเข้าสู่ระบบบัญชี Roblox บนเบราว์เซอร์เพื่อแก้ Captcha"};return labels[error.code]??error.message;}
async function respondError(context:FeatureContext,interaction:Interaction,error:unknown){const message=error instanceof Error?error.message:"เกิดข้อผิดพลาด";console.error(`Robux Payout failed for ${context.botId}:`,error);if(!interaction.isRepliable())return;const user="user" in interaction?interaction.user:null;const payload=render(context,"failed",{reason:message,content:message,username:"-",datetime:dateTime(),avatar:user?.displayAvatarURL()??""},[]);if(interaction.deferred||interaction.replied)await interaction.editReply(payload).catch(()=>undefined);else await interaction.reply({...payload,flags:MessageFlags.Ephemeral|("flags" in payload?payload.flags:0)}).catch(()=>undefined);}
function arrayConfig(value:unknown):unknown[]{if(Array.isArray(value))return value;if(typeof value==="string")try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{return [];}return [];}
function stringConfig(value:unknown,fallback:string){return typeof value==="string"&&value.trim()?value.trim():fallback;}
function numberConfig(value:unknown,fallback:number){const number=Number(value);return Number.isFinite(number)?number:fallback;}
function boolConfig(value:unknown,fallback:boolean){return typeof value==="boolean"?value:fallback;}
function money(satang:number){return (satang/100).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});}
function dateTime(){return new Intl.DateTimeFormat("th-TH",{dateStyle:"medium",timeStyle:"medium"}).format(new Date());}
interface Package{robux:number;priceSatang:number}
function isRecord(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==="object"&&!Array.isArray(value);}
interface PendingPurchase{memberId:string;groupKey:string;groupName:string;robloxUserId:number;robloxUsername:string;packages:Package[];selected?:Package;expiresAt:number}
