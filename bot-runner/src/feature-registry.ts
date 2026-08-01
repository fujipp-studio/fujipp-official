import { welcomeMessageFeature } from "./features/welcome-message.js";
import type { FeatureModule } from "./types.js";

const modules = new Map<string, FeatureModule>([
  [welcomeMessageFeature.runtimeKey, welcomeMessageFeature],
]);

export function getFeature(runtimeKey: string): FeatureModule | undefined {
  return modules.get(runtimeKey);
}
