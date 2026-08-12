import { extractStandardPrices } from "./price-extractor.js";
import { createPriceReaderFeature } from "./v1.0.0.js";

export const priceReaderFeatureV2 = createPriceReaderFeature({
  version: "2.0.0",
  extract: extractStandardPrices,
  showNoNitroMarkup: false,
});
