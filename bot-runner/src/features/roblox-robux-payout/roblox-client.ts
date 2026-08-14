import axios,{AxiosError,type AxiosRequestConfig,type AxiosResponse} from "axios";
import { authenticator } from "otplib";

export interface RobloxGroup { key:string; name:string; groupId:number; cookie:string; totpSecret?:string; openCloudApiKey?:string; }
export interface RobloxFailure { code:string; message:string; status?:number; providerCode?:number; unknownOutcome?:boolean; retryAfterSeconds?:number; }
type Result<T> = ({ok:true}&T)|{ok:false;error:RobloxFailure};

const GROUPS_API_BASE="https://groups.roblox.com";
const ECONOMY_API_BASE="https://economy.roblox.com";
const USERS_API_BASE="https://users.roblox.com";
const THUMBNAILS_API_BASE="https://thumbnails.roblox.com";
const TWO_STEP_API_BASE="https://twostepverification.roblox.com";
const AUTH_API_BASE="https://auth.roblox.com";
const OPEN_CLOUD_API_BASE="https://apis.roblox.com/cloud/v2";
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

export async function groupFunds(group:RobloxGroup):Promise<Result<{robux:number}>>{
  try{
    const response=await axios.get(`${ECONOMY_API_BASE}/v1/groups/${group.groupId}/currency`,{headers:headers(group),timeout:REQUEST_TIMEOUT_MS});
    return {ok:true,robux:Number(response.data?.robux??0)};
  }catch(error){return {ok:false,error:axiosFailure(error,false)};}
}

export async function eligibility(username:string,group:RobloxGroup):Promise<Result<{eligible:boolean;userId:number;username:string}>>{
  try{
    const lookup=await axios.post(`${USERS_API_BASE}/v1/usernames/users`,{usernames:[username.trim()],excludeBannedUsers:true},{headers:headers(group),timeout:REQUEST_TIMEOUT_MS});
    const user=(lookup.data?.data as Array<Record<string,unknown>>|undefined)?.[0];
    if(!user)return {ok:false,error:{code:"USER_NOT_FOUND",message:`ไม่พบผู้ใช้ Roblox ชื่อ ${username}`}};
    const userId=Number(user.id);const canonical=String(user.name);
    const result=await axios.get(`${ECONOMY_API_BASE}/v1/groups/${group.groupId}/users-payout-eligibility?userIds=${userId}`,{headers:headers(group),timeout:REQUEST_TIMEOUT_MS});
    const status=(result.data?.usersGroupPayoutEligibility as Record<string,string>|undefined)?.[String(userId)];
    return {ok:true,eligible:status==="Eligible",userId,username:canonical};
  }catch(error){return {ok:false,error:axiosFailure(error,false)};}
}

export async function groupMembership(username:string,groupId:number,apiKey:string):Promise<Result<{isMember:boolean;userId:number;username:string;createTime?:string}>>{
  try{
    const lookup=await axios.post(`${USERS_API_BASE}/v1/usernames/users`,{usernames:[username.trim()],excludeBannedUsers:true},{headers:headers(),timeout:REQUEST_TIMEOUT_MS});
    const user=(lookup.data?.data as Array<Record<string,unknown>>|undefined)?.[0];
    if(!user)return {ok:false,error:{code:"USER_NOT_FOUND",message:`ไม่พบผู้ใช้ Roblox ชื่อ ${username}`}};
    const userId=Number(user.id);const canonical=String(user.name);
    const response=await axios.get(`${OPEN_CLOUD_API_BASE}/groups/${groupId}/memberships`,{
      params:{filter:`user == 'users/${userId}'`,maxPageSize:1},
      headers:{Accept:"application/json","x-api-key":apiKey},timeout:REQUEST_TIMEOUT_MS,
    });
    const membership=(response.data?.groupMemberships as Array<Record<string,unknown>>|undefined)?.[0];
    if(!membership)return {ok:true,isMember:false,userId,username:canonical};
    const createTime=String(membership.createTime??"");
    if(!createTime||!Number.isFinite(Date.parse(createTime)))return {ok:false,error:{code:"ROBLOX_MEMBERSHIP_DATE_MISSING",message:"Roblox ไม่ส่งวันที่เข้ากลุ่มของสมาชิกคนนี้กลับมา"}};
    return {ok:true,isMember:true,userId,username:canonical,createTime};
  }catch(error){
    const axiosError=asAxiosError(error);
    if(axiosError.response?.status===401||axiosError.response?.status===403)return {ok:false,error:{code:"ROBLOX_OPEN_CLOUD_UNAUTHORIZED",message:"Open Cloud API Key ไม่ถูกต้อง ไม่มีสิทธิ์อ่านกลุ่ม หรือหมดอายุ",status:axiosError.response.status}};
    return {ok:false,error:axiosFailure(error,false)};
  }
}

export async function userAvatar(userId:number):Promise<string>{
  try{
    const response=await axios.get(`${THUMBNAILS_API_BASE}/v1/users/avatar-headshot`,{params:{userIds:userId,size:"420x420",format:"Png",isCircular:false},headers:headers(),timeout:REQUEST_TIMEOUT_MS});
    return String(response.data?.data?.[0]?.imageUrl??"");
  }catch{return "";}
}

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
  if(challengeType==="blocksession")return {ok:false,error:blockedSession(axiosError.response)};
  if(challengeType==="chef")return {ok:false,error:{code:"ROBLOX_CHALLENGE_CHEF",message:`Roblox ต้องการการยืนยันตัวตน (Captcha/Chef) กรุณาเข้าสู่ระบบบัญชี Roblox บนเบราว์เซอร์ใหม่เพื่อแก้ Captcha`,...(axiosError.response?.status?{status:axiosError.response.status}:{})}};
  if(challengeType)return {ok:false,error:{code:"ROBLOX_CHALLENGE_UNSUPPORTED",message:`Roblox ต้องการ challenge ชนิด ${challengeType} ซึ่ง runner ไม่สามารถยืนยันแทนได้`,...(axiosError.response?.status?{status:axiosError.response.status}:{})}};
  return {ok:false,error:axiosFailure(error,true)};
}

async function handle2FAChallenge(group:RobloxGroup,url:string,payload:unknown,firstChallengeId:string,encodedMetadata:string):Promise<Result<{data:Record<string,unknown>}>>{
  if(!group.totpSecret)return {ok:false,error:{code:"ROBLOX_2FA_REQUIRED",message:"Roblox ต้องการ 2FA แต่ยังไม่ได้ตั้ง TOTP secret"}};
  let metadata:Record<string,unknown>;
  try{metadata=JSON.parse(Buffer.from(encodedMetadata,"base64").toString("utf8")) as Record<string,unknown>;}
  catch{return {ok:false,error:{code:"ROBLOX_CHALLENGE_INVALID",message:"ไม่สามารถ parse challenge metadata ได้"}};}
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
    await axios.post("https://apis.roblox.com/challenge/v1/continue",{challengeId:firstChallengeId,challengeMetadata:responseMetadataJson,challengeType:"twostepverification"},{headers:headers(group,true),timeout:REQUEST_TIMEOUT_MS});
  }catch(error){
    const shared=metadata.sharedParameters as Record<string,unknown>|undefined;
    if(shared?.useContinueMode!==false)return {ok:false,error:axiosFailure(error,false)};
  }

  const baseHeaders={...headers(group,true),"rblx-challenge-id":firstChallengeId,"rblx-challenge-type":"twostepverification"};
  try{
    const final=await axios.post(url,payload,{headers:{...baseHeaders,"rblx-challenge-metadata":Buffer.from(responseMetadataJson).toString("base64")},timeout:REQUEST_TIMEOUT_MS});
    return success(final);
  }catch(error){
    const failure=axiosFailure(error,true);
    if(!/challenge/i.test(failure.message))return {ok:false,error:failure};
    try{
      const final=await axios.post(url,payload,{headers:{...baseHeaders,"rblx-challenge-metadata":responseMetadataJson},timeout:REQUEST_TIMEOUT_MS});
      return success(final);
    }catch(jsonError){return {ok:false,error:axiosFailure(jsonError,true)};}
  }
}

function success(response:AxiosResponse):Result<{data:Record<string,unknown>}>{return {ok:true,data:objectData(response.data)};}
function objectData(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};}
function asAxiosError(error:unknown){return error instanceof AxiosError?error:axios.isAxiosError(error)?error:new AxiosError(error instanceof Error?error.message:String(error));}
function header(response:AxiosResponse|undefined,name:string){const value=response?.headers?.[name];return Array.isArray(value)?String(value[0]??""):String(value??"");}
function blockedSession(response:AxiosResponse|undefined):RobloxFailure{
  const seconds=Number(header(response,"retry-after"));
  return {code:"ROBLOX_SESSION_BLOCKED",message:"Roblox บล็อก Session นี้ชั่วคราว หยุดส่ง payout และรอ Retry-After ก่อนเข้าสู่ระบบใหม่",...(response?.status?{status:response.status}:{}),...(Number.isFinite(seconds)&&seconds>0?{retryAfterSeconds:seconds}:{})};
}
function axiosFailure(error:unknown,payoutAttempt:boolean):RobloxFailure{
  const axiosError=asAxiosError(error);const response=axiosError.response;const data=objectData(response?.data);
  const item=(data.errors as Array<Record<string,unknown>>|undefined)?.[0];const providerCode=Number(item?.code);
  const message=String(item?.message??axiosError.message??`Roblox ตอบกลับ HTTP ${response?.status??"unknown"}`);
  const codes:Record<number,string>={1:"ROBLOX_GROUP_INVALID",12:"ROBLOX_INSUFFICIENT_FUNDS",22:"ROBLOX_FEATURE_DISABLED",23:"ROBLOX_INSUFFICIENT_PERMISSIONS",24:"ROBLOX_INVALID_PAYOUT_TYPE",25:"ROBLOX_INVALID_AMOUNT",26:"ROBLOX_TOO_MANY_RECIPIENTS",28:"ROBLOX_PAYOUT_RATE_LIMIT",35:"ROBLOX_2FA_REQUIRED"};
  return {code:codes[providerCode]??(response?"ROBLOX_REJECTED":"ROBLOX_UNAVAILABLE"),message,...(response?.status?{status:response.status}:{}),...(Number.isFinite(providerCode)?{providerCode}:{}),unknownOutcome:payoutAttempt&&(!response||response.status>=500)};
}
