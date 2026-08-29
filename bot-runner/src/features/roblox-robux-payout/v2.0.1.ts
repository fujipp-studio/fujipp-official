import { createRobloxRobuxPayoutFeature } from "./v1.0.0.js";

export const ROBUX_PAYOUT_V201_PURCHASE_FORM={maxLength:50,title:"กรอกชื่อเติม Robux"} as const;

export const robloxRobuxPayoutFeatureV201=createRobloxRobuxPayoutFeature("2.0.1",true,ROBUX_PAYOUT_V201_PURCHASE_FORM.maxLength,ROBUX_PAYOUT_V201_PURCHASE_FORM.title);
