import { geminiKeyPattern, geminiModelPattern, geminiPricePrompt, geminiPriceSchema, parseGeminiPrice, type GeminiPrice } from "./gemini-contract.js";
import { classifiedGeminiPricePrompt, classifiedGeminiPriceSchema, parseClassifiedGeminiPrice, type ClassifiedGeminiPrice } from "./classified-pricing.js";

export class GeminiReadError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs = 0) { super(code); }
}

export async function readGeminiImage(apiKey: string, model: string, image: Buffer, mimeType: string, signal?: AbortSignal, classified = false): Promise<GeminiPrice | ClassifiedGeminiPrice> {
  if (!geminiKeyPattern.test(apiKey)) throw new GeminiReadError("GEMINI_KEY_INVALID");
  if (!geminiModelPattern.test(model)) throw new GeminiReadError("GEMINI_MODEL_UNAVAILABLE");
  if (!image.length || image.length > 10 * 1024 * 1024 || !["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
    throw new GeminiReadError("GEMINI_IMAGE_INVALID");
  }
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", redirect: "error",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25_000)]) : AbortSignal.timeout(25_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: classified ? classifiedGeminiPricePrompt : geminiPricePrompt }] },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: image.toString("base64") } }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json", responseJsonSchema: classified ? classifiedGeminiPriceSchema : geminiPriceSchema },
      }),
    });
    if (!response.ok) {
      // Never include Google's response body, request headers or API key in diagnostics.
      const retry = response.headers.get("retry-after");
      const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : 60;
      const code = response.status === 429 ? "GEMINI_QUOTA_EXCEEDED"
        : [401, 403].includes(response.status) ? "GEMINI_KEY_INVALID"
        : response.status === 400 ? "GEMINI_REQUEST_REJECTED"
        : response.status === 404 ? "GEMINI_MODEL_UNAVAILABLE" : "GEMINI_UNAVAILABLE";
      await response.body?.cancel();
      throw new GeminiReadError(code, response.status === 429 ? Math.max(1_000, Math.min(seconds * 1000, 300_000)) : 0);
    }
    const stream = response.body?.getReader();
    if (!stream) throw new GeminiReadError("GEMINI_INVALID_RESPONSE");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const chunk = await stream.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 65_536) {
        await stream.cancel();
        throw new GeminiReadError("GEMINI_INVALID_RESPONSE");
      }
      chunks.push(chunk.value);
    }
    let body: { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new GeminiReadError("GEMINI_INVALID_RESPONSE"); }
    const candidate = body && Array.isArray(body.candidates) ? body.candidates[0] : undefined;
    if (candidate?.finishReason !== "STOP") throw new GeminiReadError("GEMINI_INVALID_RESPONSE");
    if (!Array.isArray(candidate.content?.parts)) throw new GeminiReadError("GEMINI_INVALID_RESPONSE");
    const text = candidate.content?.parts?.filter(part => !part.thought).map(part => part.text ?? "").join("") ?? "";
    if (text.length > 10_000) throw new GeminiReadError("GEMINI_INVALID_RESPONSE");
    try { return classified ? parseClassifiedGeminiPrice(JSON.parse(text)) : parseGeminiPrice(JSON.parse(text)); }
    catch { throw new GeminiReadError("GEMINI_INVALID_RESPONSE"); }
  } catch (error) {
    if (error instanceof GeminiReadError) throw error;
    throw new GeminiReadError("GEMINI_UNAVAILABLE");
  }
}
