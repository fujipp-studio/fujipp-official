import { welcomeMessageFeature } from "./features/welcome-message.js";
import { voiceKeeperFeature } from "./features/voice-keeper/index.js";
import { botPresenceFeature } from "./features/bot-presence/index.js";
import { reviewCreditFeature, reviewCreditFeatureV11 } from "./features/review-credit/index.js";
import { walletTopupFeature, walletTopupFeatureV2, walletTopupFeatureV21 } from "./features/wallet-topup/index.js";
import { robloxRobuxPayoutFeature, robloxRobuxPayoutFeatureV2, robloxRobuxPayoutFeatureV201, robloxRobuxPayoutFeatureV21, robloxRobuxPayoutFeatureV22 } from "./features/roblox-robux-payout/index.js";
import { priceReaderFeature, priceReaderFeatureV2 } from "./features/price-reader/index.js";
import { adminMessageToolsFeature } from "./features/admin-message-tools/index.js";
import { runtimeExpiryAlertFeature } from "./features/runtime-expiry-alert/index.js";
import { memberSpendingFeature } from "./features/member-spending/index.js";
import { botPermissionsFeature } from "./features/bot-permissions/index.js";
import { channelMessageTriggersFeature } from "./features/channel-message-triggers/index.js";
import type { FeatureModule } from "./types.js";

const modules = new Map<string, FeatureModule>([
  [moduleKey(welcomeMessageFeature.runtimeKey, welcomeMessageFeature.version), welcomeMessageFeature],
  [moduleKey(voiceKeeperFeature.runtimeKey, voiceKeeperFeature.version), voiceKeeperFeature],
  [moduleKey(botPresenceFeature.runtimeKey, botPresenceFeature.version), botPresenceFeature],
  [moduleKey(reviewCreditFeature.runtimeKey, reviewCreditFeature.version), reviewCreditFeature],
  [moduleKey(reviewCreditFeatureV11.runtimeKey, reviewCreditFeatureV11.version), reviewCreditFeatureV11],
  [moduleKey(walletTopupFeature.runtimeKey, walletTopupFeature.version), walletTopupFeature],
  [moduleKey(walletTopupFeatureV2.runtimeKey, walletTopupFeatureV2.version), walletTopupFeatureV2],
  [moduleKey(walletTopupFeatureV21.runtimeKey, walletTopupFeatureV21.version), walletTopupFeatureV21],
  [moduleKey(robloxRobuxPayoutFeature.runtimeKey, robloxRobuxPayoutFeature.version), robloxRobuxPayoutFeature],
  [moduleKey(robloxRobuxPayoutFeatureV2.runtimeKey, robloxRobuxPayoutFeatureV2.version), robloxRobuxPayoutFeatureV2],
  [moduleKey(robloxRobuxPayoutFeatureV201.runtimeKey, robloxRobuxPayoutFeatureV201.version), robloxRobuxPayoutFeatureV201],
  [moduleKey(robloxRobuxPayoutFeatureV21.runtimeKey, robloxRobuxPayoutFeatureV21.version), robloxRobuxPayoutFeatureV21],
  [moduleKey(robloxRobuxPayoutFeatureV22.runtimeKey, robloxRobuxPayoutFeatureV22.version), robloxRobuxPayoutFeatureV22],
  [moduleKey(priceReaderFeature.runtimeKey, priceReaderFeature.version), priceReaderFeature],
  [moduleKey(priceReaderFeatureV2.runtimeKey, priceReaderFeatureV2.version), priceReaderFeatureV2],
  [moduleKey(adminMessageToolsFeature.runtimeKey, adminMessageToolsFeature.version), adminMessageToolsFeature],
  [moduleKey(runtimeExpiryAlertFeature.runtimeKey, runtimeExpiryAlertFeature.version), runtimeExpiryAlertFeature],
  [moduleKey(memberSpendingFeature.runtimeKey, memberSpendingFeature.version), memberSpendingFeature],
  [moduleKey(botPermissionsFeature.runtimeKey, botPermissionsFeature.version), botPermissionsFeature],
  [moduleKey(channelMessageTriggersFeature.runtimeKey, channelMessageTriggersFeature.version), channelMessageTriggersFeature],
]);

export function getFeature(runtimeKey: string, version: string): FeatureModule | undefined {
  return modules.get(moduleKey(runtimeKey, version));
}

function moduleKey(runtimeKey: string, version: string): string {
  return `${runtimeKey}@${version}`;
}
