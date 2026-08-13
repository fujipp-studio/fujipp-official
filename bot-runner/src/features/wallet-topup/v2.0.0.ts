import type { FeatureModule } from "../../types.js";
import { activateWalletTopup } from "./v1.0.0.js";

export const walletTopupFeatureV2: FeatureModule = {
  runtimeKey: "wallet-topup",
  version: "2.0.0",
  intents: ["Guilds", "GuildMessages", "MessageContent", "GuildMembers"],
  activate: (context) => activateWalletTopup(context, true),
};
