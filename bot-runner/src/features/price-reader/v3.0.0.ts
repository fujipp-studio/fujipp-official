import sharp from "sharp";
import { createPriceReaderFeature } from "./v1.0.0.js";
import { readGeminiImage, GeminiReadError } from "./gemini-client.js";
import { defaultGeminiModel, geminiErrorMessages, geminiKeyPattern, geminiModelPattern } from "./gemini-contract.js";
import { readGeminiResult, imageError } from "./results.js";
import { readClassifiedGeminiResult } from "./classified-pricing.js";

export function createGeminiPriceReaderFeature(version: string, classified = false) { return createPriceReaderFeature({
  version,
  createReader(context) {
    const key = context.secrets.GEMINI_API_KEY?.trim() ?? "";
    const model = String(context.config.PRICE_READER_GEMINI_MODEL ?? defaultGeminiModel);
    if (!geminiKeyPattern.test(key)) throw new Error("GEMINI_KEY_INVALID: Configure a Gemini API key in Price Reader settings");
    if (!geminiModelPattern.test(model)) throw new Error("GEMINI_MODEL_UNAVAILABLE: Check the configured model");
    const controller = new AbortController();
    let retryAt = 0;
    return {
      stop() { controller.abort(); },
      async read(raw) {
        try {
          if (Date.now() < retryAt) throw new GeminiReadError("GEMINI_QUOTA_EXCEEDED");
          // Preserve colour and layout; do not apply the OCR grayscale/sharpen pipeline.
          const image = await sharp(raw, { limitInputPixels: 40_000_000, animated: false })
            .rotate().resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
            .flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
          const result = await readGeminiImage(key, model, image, "image/jpeg", controller.signal, classified);
          return classified ? readClassifiedGeminiResult(result, context.config) : readGeminiResult(result, context.config);
        } catch (error) {
          if (controller.signal.aborted) return imageError(context.config, "ocr_error");
          const code = error instanceof GeminiReadError ? error.code : "GEMINI_IMAGE_INVALID";
          if (error instanceof GeminiReadError && error.retryAfterMs) retryAt = Date.now() + error.retryAfterMs;
          void context.reportFeatureError(code, new Error(code), { recoverable: true }).catch(() => undefined);
          return { status: "error", error_message: geminiErrorMessages[code]?.[1] ?? geminiErrorMessages.GEMINI_UNAVAILABLE![1] };
        }
      },
    };
  },
}); }

export const priceReaderFeatureV3 = createGeminiPriceReaderFeature("3.0.0");
