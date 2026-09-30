import axios,{AxiosError,type AxiosResponse} from "axios";
import { authenticator } from "otplib";

export interface RobloxGroup { groupId:number; cookie:string; totpSecret?:string; }
export interface RobloxFailure { code:string; message:string; status?:number; providerCode?:number; unknownOutcome?:boolean; retryAfterSeconds?:number; challengeStage?:"payout"|"chef"|"2fa"; challengeReason?:string; }
type Result<T> = ({ok:true}&T)|{ok:false;error:RobloxFailure};

const GROUPS_API_BASE="https://groups.roblox.com";
const TWO_STEP_API_BASE="https://twostepverification.roblox.com";
const AUTH_API_BASE="https://auth.roblox.com";
const REQUEST_TIMEOUT_MS=12_000;
const csrfTokens=new Map<string,string>();

function csrfFor(cookie:string){return csrfTokens.get(cookie);}
function rememberCsrf(cookie:string,value:string){if(cookie&&value)csrfTokens.set(cookie,value);}

export async function ensureCsrfToken(group:RobloxGroup):Promise<string>{
  if(group.cookie&&csrfFor(group.cookie))return csrfFor(group.cookie)!;
  try{
    await axios.post(`${AUTH_API_BASE}/v2/logout`,{},{headers:headers(group),timeout:REQUEST_TIMEOUT_MS});
  }catch(error){
    const axiosError=asAxiosError(error);
    const csrf=header(axiosError.response,"x-csrf-token");
    if(csrf){rememberCsrf(group.cookie,csrf);return csrf;}
  }
  return csrfFor(group.cookie)??"";
}

const headers=(group?:RobloxGroup,csrf=false):Record<string,string>=>({
  "Content-Type":"application/json",
  Accept:"application/json, text/plain, */*",
  "Accept-Language":"en-US,en;q=0.9,th;q=0.8",
  Origin:"https://www.roblox.com",
  Referer:"https://www.roblox.com/",
  "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "sec-ch-ua":'"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  "sec-ch-ua-mobile":"?0",
  "sec-ch-ua-platform":'"Windows"',
  "sec-fetch-dest":"empty",
  "sec-fetch-mode":"cors",
  "sec-fetch-site":"same-site",
  ...(group?.cookie?{Cookie:`.ROBLOSECURITY=${group.cookie}`}:{}),
  ...(csrf&&group?.cookie&&csrfFor(group.cookie)?{"X-CSRF-TOKEN":csrfFor(group.cookie)!}:{}),
});

/** Port of discord-bot-001-kanom-roblox/api/roblox.js makeOneTimePayout. */
export async function payout(group:RobloxGroup,userId:number,amount:number):Promise<Result<{data:Record<string,unknown>}>>{
  await ensureCsrfToken(group);
  const url=`${GROUPS_API_BASE}/v1/groups/${group.groupId}/payouts`;
  const payload={PayoutType:"FixedAmount",Recipients:[{recipientId:Number(userId),recipientType:"User",amount:Number(amount)}]};
  const attempt=(extraHeaders:Record<string,string>={})=>axios.post(url,payload,{headers:{...headers(group,true),...extraHeaders},timeout:REQUEST_TIMEOUT_MS});

  try{return success(await attempt());}
  catch(firstError){
    const first=asAxiosError(firstError);
    const newCsrf=header(first.response,"x-csrf-token");
    if(first.response?.status===403&&newCsrf){
      rememberCsrf(group.cookie,newCsrf);
      try{return success(await attempt());}
      catch(retryError){return handlePayoutFailure(group,url,payload,retryError);}
    }
    return handlePayoutFailure(group,url,payload,firstError);
  }
}

async function handlePayoutFailure(group:RobloxGroup,url:string,payload:unknown,error:unknown):Promise<Result<{data:Record<string,unknown>}>>{
  const axiosError=asAxiosError(error);
  const challengeId=header(axiosError.response,"rblx-challenge-id");
  const challengeType=header(axiosError.response,"rblx-challenge-type").toLowerCase();
  const challengeMetadata=header(axiosError.response,"rblx-challenge-metadata");
  if(challengeId&&challengeType==="twostepverification")return handle2FAChallenge(group,url,payload,challengeId,challengeMetadata);
  if(challengeType==="blocksession")return {ok:false,error:blockedSession(axiosError.response,"payout")};
  if(challengeType==="chef")return handleChefChallenge(group,url,payload,challengeId,challengeMetadata);
  if(challengeType)return {ok:false,error:{code:"ROBLOX_CHALLENGE_UNSUPPORTED",message:`Roblox ต้องการ challenge ชนิด ${challengeType} ซึ่ง runner ไม่สามารถยืนยันแทนได้`,...(axiosError.response?.status?{status:axiosError.response.status}:{})}};
  return {ok:false,error:axiosFailure(error,true)};
}

async function handleChefChallenge(group:RobloxGroup,url:string,payload:unknown,challengeId:string,encodedMetadata:string):Promise<Result<{data:Record<string,unknown>}>>{
  const metadata=parseChallengeMetadata(encodedMetadata);
  if(!challengeId||!metadata)return {ok:false,error:{code:"ROBLOX_CHALLENGE_INVALID",message:"Roblox ส่งข้อมูล chef challenge ไม่ครบ"}};
  let continued:AxiosResponse;
  try{
    continued=await axios.post("https://apis.roblox.com/challenge/v1/continue",{challengeId,challengeType:"chef",challengeMetadata:JSON.stringify(metadata)},{headers:headers(group,true),timeout:REQUEST_TIMEOUT_MS});
  }catch(error){
    const response=asAxiosError(error).response;
    const type=String(objectData(response?.data).challengeType??header(response,"rblx-challenge-type")).toLowerCase();
    if(type==="blocksession")return {ok:false,error:blockedSession(response,"chef")};
    if(type==="captcha")return {ok:false,error:captchaChallenge(response)};
    return {ok:false,error:axiosFailure(error,false)};
  }
  const next=objectData(continued.data);
  const nextType=String(next.challengeType??"").toLowerCase();
  if(nextType==="blocksession")return {ok:false,error:blockedSession(continued,"chef")};
  if(nextType==="captcha")return {ok:false,error:captchaChallenge(continued)};
  if(nextType==="twostepverification"){
    const nextMetadata=next.challengeMetadata;
    if(typeof nextMetadata!=="string")return {ok:false,error:{code:"ROBLOX_CHALLENGE_INVALID",message:"Roblox ไม่ส่งข้อมูล 2FA หลัง chef challenge"}};
    return handle2FAChallenge(group,url,payload,challengeId,nextMetadata);
  }
  if(!nextType){
    try{return success(await axios.post(url,payload,{headers:headers(group,true),timeout:REQUEST_TIMEOUT_MS}));}
    catch(error){
      const response=asAxiosError(error).response;
      const retryType=header(response,"rblx-challenge-type").toLowerCase();
      if(retryType==="blocksession")return {ok:false,error:blockedSession(response,"payout")};
      if(retryType==="captcha")return {ok:false,error:captchaChallenge(response)};
      if(retryType==="twostepverification")return handle2FAChallenge(group,url,payload,header(response,"rblx-challenge-id"),header(response,"rblx-challenge-metadata"));
      if(retryType==="chef")return {ok:false,error:{code:"ROBLOX_CHALLENGE_CHEF",message:"Roblox ยังต้องการการยืนยันตัวตนเพิ่มเติมสำหรับคำขอโอนนี้"}};
      return {ok:false,error:axiosFailure(error,true)};
    }
  }
  return {ok:false,error:{code:"ROBLOX_CHALLENGE_UNSUPPORTED",message:`Roblox ต้องการ challenge ชนิด ${nextType} หลัง chef`,...(continued.status?{status:continued.status}:{})}};
}

async function handle2FAChallenge(group:RobloxGroup,url:string,payload:unknown,firstChallengeId:string,encodedMetadata:string):Promise<Result<{data:Record<string,unknown>}>>{
  if(!firstChallengeId)return {ok:false,error:{code:"ROBLOX_CHALLENGE_INVALID",message:"Roblox ไม่ส่ง challenge ID สำหรับ 2FA"}};
  if(!group.totpSecret)return {ok:false,error:{code:"ROBLOX_2FA_REQUIRED",message:"Roblox ต้องการ 2FA แต่ยังไม่ได้ตั้ง TOTP secret"}};
  const metadata=parseChallengeMetadata(encodedMetadata);
  if(!metadata)return {ok:false,error:{code:"ROBLOX_CHALLENGE_INVALID",message:"ไม่สามารถ parse challenge metadata ได้"}};
  const secondChallengeId=String(metadata.challengeId??"");const ownerId=Number(metadata.userId);
  if(!secondChallengeId||!ownerId)return {ok:false,error:{code:"ROBLOX_CHALLENGE_INVALID",message:"Metadata ไม่มี challengeId หรือ userId"}};

  let code:string;
  try{code=authenticator.generate(group.totpSecret.replace(/\s+/g,""));}
  catch{return {ok:false,error:{code:"ROBLOX_TOTP_SECRET_INVALID",message:"ไม่สามารถสร้าง TOTP code ได้ - ตรวจสอบ TOTP secret"}};}

  let verificationToken:string;
  try{
    const verification=await axios.post(`${TWO_STEP_API_BASE}/v1/users/${ownerId}/challenges/authenticator/verify`,{challengeId:secondChallengeId,actionType:"Generic",code},{headers:headers(group,true),timeout:REQUEST_TIMEOUT_MS});
    verificationToken=String(verification.data?.verificationToken??"");
  }catch(error){return {ok:false,error:axiosFailure(error,false)};}
  if(!verificationToken)return {ok:false,error:{code:"ROBLOX_2FA_FAILED",message:"2FA verification failed - ไม่ได้รับ verification token"}};

  const responseMetadataJson=JSON.stringify({verificationToken,rememberDevice:false,challengeId:secondChallengeId,actionType:"Generic"});
  try{
    const continued=await axios.post("https://apis.roblox.com/challenge/v1/continue",{challengeId:firstChallengeId,challengeMetadata:responseMetadataJson,challengeType:"twostepverification"},{headers:headers(group,true),timeout:REQUEST_TIMEOUT_MS});
    const nextType=String(objectData(continued.data).challengeType??"").toLowerCase();
    if(nextType==="blocksession")return {ok:false,error:blockedSession(continued,"2fa")};
    if(nextType==="captcha")return {ok:false,error:captchaChallenge(continued)};
    if(nextType)return {ok:false,error:{code:"ROBLOX_CHALLENGE_UNSUPPORTED",message:`Roblox ต้องการ challenge ชนิด ${nextType} หลังการยืนยัน 2FA`}};
  }catch(error){
    const response=asAxiosError(error).response;
    const type=String(objectData(response?.data).challengeType??header(response,"rblx-challenge-type")).toLowerCase();
    if(type==="blocksession")return {ok:false,error:blockedSession(response,"2fa")};
    if(type==="captcha")return {ok:false,error:captchaChallenge(response)};
    const shared=metadata.sharedParameters as Record<string,unknown>|undefined;
    if(shared?.useContinueMode!==false)return {ok:false,error:axiosFailure(error,false)};
  }

  const baseHeaders={...headers(group,true),"rblx-challenge-id":firstChallengeId,"rblx-challenge-type":"twostepverification"};
  try{
    const final=await axios.post(url,payload,{headers:{...baseHeaders,"rblx-challenge-metadata":Buffer.from(responseMetadataJson).toString("base64")},timeout:REQUEST_TIMEOUT_MS});
    return success(final);
  }catch(error){
    if(header(asAxiosError(error).response,"rblx-challenge-type").toLowerCase()==="blocksession")return {ok:false,error:blockedSession(asAxiosError(error).response,"payout")};
    const failure=axiosFailure(error,true);
    if(!/challenge/i.test(failure.message))return {ok:false,error:failure};
    try{
      const final=await axios.post(url,payload,{headers:{...baseHeaders,"rblx-challenge-metadata":responseMetadataJson},timeout:REQUEST_TIMEOUT_MS});
      return success(final);
    }catch(jsonError){
      if(header(asAxiosError(jsonError).response,"rblx-challenge-type").toLowerCase()==="blocksession")return {ok:false,error:blockedSession(asAxiosError(jsonError).response,"payout")};
      return {ok:false,error:axiosFailure(jsonError,true)};
    }
  }
}

function parseChallengeMetadata(value:string):Record<string,unknown>|null{
  for(const candidate of [value,Buffer.from(value,"base64").toString("utf8")]){
    try{const parsed:unknown=JSON.parse(candidate);if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))return parsed as Record<string,unknown>;}catch{/* try the next encoding */}
  }
  return null;
}

function success(response:AxiosResponse):Result<{data:Record<string,unknown>}>{return {ok:true,data:objectData(response.data)};}
function objectData(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function asAxiosError(error:unknown){return error instanceof AxiosError?error:axios.isAxiosError(error)?error:new AxiosError(error instanceof Error?error.message:String(error));}
function header(response:AxiosResponse|undefined,name:string){const value=response?.headers?.[name];return Array.isArray(value)?String(value[0]??""):String(value??"");}
function blockedSession(response:AxiosResponse|undefined,challengeStage:"payout"|"chef"|"2fa"):RobloxFailure{
  const seconds=Number(header(response,"retry-after"));
  const challengeMetadata=objectData(response?.data).challengeMetadata;
  const metadata=parseChallengeMetadata(typeof challengeMetadata==="string"?challengeMetadata:header(response,"rblx-challenge-metadata"));
  const reason=metadata?.bodyTranslationKey;
  return {code:"ROBLOX_SESSION_BLOCKED",message:"Roblox ปฏิเสธ session นี้สำหรับคำขอโอน หยุดทดสอบและตรวจสอบการแจ้งเตือนความปลอดภัยของบัญชี",challengeStage,...(response?.status?{status:response.status}:{}),...(Number.isFinite(seconds)&&seconds>0?{retryAfterSeconds:seconds}:{}),...(typeof reason==="string"&&/^[A-Za-z0-9._-]{1,100}$/.test(reason)?{challengeReason:reason}:{})};
}
function captchaChallenge(response:AxiosResponse|undefined):RobloxFailure{
  return {code:"ROBLOX_CHALLENGE_CAPTCHA",message:"Roblox ขอ CAPTCHA สำหรับคำขอโอนจากบอท ซึ่งต้องให้เจ้าของบัญชียืนยันผ่าน Roblox",...(response?.status&&response.status>=400?{status:response.status}:{})};
}
function axiosFailure(error:unknown,payoutAttempt:boolean):RobloxFailure{
  const axiosError=asAxiosError(error);const response=axiosError.response;const data=objectData(response?.data);
  const item=(data.errors as Array<Record<string,unknown>>|undefined)?.[0];const providerCode=Number(item?.code);
  const message=String(item?.message??axiosError.message??`Roblox ตอบกลับ HTTP ${response?.status??"unknown"}`);
  const codes:Record<number,string>={1:"ROBLOX_GROUP_INVALID",12:"ROBLOX_INSUFFICIENT_FUNDS",22:"ROBLOX_FEATURE_DISABLED",23:"ROBLOX_INSUFFICIENT_PERMISSIONS",24:"ROBLOX_INVALID_PAYOUT_TYPE",25:"ROBLOX_INVALID_AMOUNT",26:"ROBLOX_TOO_MANY_RECIPIENTS",28:"ROBLOX_PAYOUT_RATE_LIMIT",35:"ROBLOX_2FA_REQUIRED"};
  return {code:codes[providerCode]??(response?"ROBLOX_REJECTED":"ROBLOX_UNAVAILABLE"),message,...(response?.status?{status:response.status}:{}),...(Number.isFinite(providerCode)?{providerCode}:{}),unknownOutcome:payoutAttempt&&(!response||response.status>=500)};
}
