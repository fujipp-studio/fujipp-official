import type { FeatureModule } from "../../types.js";
import { reviewCreditFeature } from "./v1.0.0.js";

export const reviewCreditFeatureV11: FeatureModule = {
  ...reviewCreditFeature,
  version: "1.1.0",
  activate: (context) => reviewCreditFeature.activate({
    ...context,
    config: {
      REVIEW_COUNT_WEBHOOKS: true,
      ...context.config,
    },
  }),
};
