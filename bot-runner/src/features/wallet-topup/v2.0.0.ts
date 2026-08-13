import type { FeatureModule } from "../../types.js";
import { walletTopupFeature } from "./v1.0.0.js";

export const walletTopupFeatureV2: FeatureModule = { ...walletTopupFeature, version: "2.0.0" };
