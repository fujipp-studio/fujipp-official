import { createRobloxRobuxPayoutFeature } from "./v1.0.0.js";
import { ROBUX_PAYOUT_V201_PURCHASE_FORM } from "./v2.0.1.js";

export const robloxRobuxPayoutFeatureV22=createRobloxRobuxPayoutFeature(
  "2.2.0",
  true,
  ROBUX_PAYOUT_V201_PURCHASE_FORM.maxLength,
  ROBUX_PAYOUT_V201_PURCHASE_FORM.title,
  true,
  "receipt",
);
