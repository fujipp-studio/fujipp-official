import { welcomeMessageFeature } from "./features/welcome-message.js";
import { voiceKeeperFeature } from "./features/voice-keeper/index.js";
import { botPresenceFeature } from "./features/bot-presence/index.js";
import { reviewCreditFeature } from "./features/review-credit/index.js";
import { walletTopupFeature, walletTopupFeatureV2 } from "./features/wallet-topup/index.js";
import { robloxRobuxPayoutFeature } from "./features/roblox-robux-payout/index.js";
import { priceReaderFeature, priceReaderFeatureV2 } from "./features/price-reader/index.js";
import { adminMessageToolsFeature } from "./features/admin-message-tools/index.js";
import { runtimeExpiryAlertFeature } from "./features/runtime-expiry-alert/index.js";
import { memberSpendingFeature } from "./features/member-spending/index.js";
import { botPermissionsFeature } from "./features/bot-permissions/index.js";
import type { FeatureModule } from "./types.js";

const modules = new Map<string, FeatureModule>([
  [moduleKey(welcomeMessageFeature.runtimeKey, welcomeMessageFeature.version), welcomeMessageFeature],
  [moduleKey(voiceKeeperFeature.runtimeKey, voiceKeeperFeature.version), voiceKeeperFeature],
  [moduleKey(botPresenceFeature.runtimeKey, botPresenceFeature.version), botPresenceFeature],
  [moduleKey(reviewCreditFeature.runtimeKey, reviewCreditFeature.version), reviewCreditFeature],
  [moduleKey(walletTopupFeature.runtimeKey, walletTopupFeature.version), walletTopupFeature],
  [moduleKey(walletTopupFeatureV2.runtimeKey, walletTopupFeatureV2.version), walletTopupFeatureV2],
  [moduleKey(robloxRobuxPayoutFeature.runtimeKey, robloxRobuxPayoutFeature.version), robloxRobuxPayoutFeature],
  [moduleKey(priceReaderFeature.runtimeKey, priceReaderFeature.version), priceReaderFeature],
  [moduleKey(priceReaderFeatureV2.runtimeKey, priceReaderFeatureV2.version), priceReaderFeatureV2],
  [moduleKey(adminMessageToolsFeature.runtimeKey, adminMessageToolsFeature.version), adminMessageToolsFeature],
  [moduleKey(runtimeExpiryAlertFeature.runtimeKey, runtimeExpiryAlertFeature.version), runtimeExpiryAlertFeature],
  [moduleKey(memberSpendingFeature.runtimeKey, memberSpendingFeature.version), memberSpendingFeature],
  [moduleKey(botPermissionsFeature.runtimeKey, botPermissionsFeature.version), botPermissionsFeature],
]);

export function getFeature(runtimeKey: string, version: string): FeatureModule | undefined {
  return modules.get(moduleKey(runtimeKey, version));
}

function moduleKey(runtimeKey: string, version: string): string {
  return `${runtimeKey}@${version}`;
}
