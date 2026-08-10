import type { FeatureModule } from "../../types.js";

export const botPermissionsFeature: FeatureModule = {
  runtimeKey: "bot-permissions",
  version: "1.0.0",
  intents: [],
  async activate() {
    return () => undefined;
  },
};
