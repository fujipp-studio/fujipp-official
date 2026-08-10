/**
 * Downloads an image from a URL (typically a Discord CDN attachment).
 * Returns the raw image bytes as a Buffer.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const safeUrl = assertDiscordCdnImageUrl(url);
  const response = await fetch(safeUrl, {
    redirect: "error",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to download image: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("image/")) throw new Error("Attachment is not an image");
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw new Error("Image is larger than 10 MB");
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is larger than 10 MB");
  return Buffer.from(arrayBuffer);
}

// Minimal sharp typings used by this module, avoiding a full module-level
// import that may fail under NodeNext resolution without @types/sharp.
interface SharpPipeline {
  metadata(): Promise<{ width?: number; height?: number }>;
  grayscale(): SharpPipeline;
  normalise(): SharpPipeline;
  sharpen(): SharpPipeline;
  resize(width: number, height: number, options: { fit: string }): SharpPipeline;
  png(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

type SharpFn = (input: Buffer) => SharpPipeline;

/**
 * Preprocesses an image buffer for better OCR accuracy:
 * - Converts to grayscale
 * - Boosts contrast via normalisation
 * - Sharpens small UI text without destroying thin currency glyphs
 * - Resizes so the shorter side is at least 1800 px (improves Tesseract accuracy)
 *
 * Returns a PNG buffer ready for Tesseract.
 */
export async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  // Dynamic import to avoid top-level side-effects.
  const sharpModule = await import("sharp" as string) as { default: SharpFn };
  const sharp = sharpModule.default;

  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  let pipeline = sharp(imageBuffer)
    .grayscale()
    .normalise()
    .sharpen();

  // Up-scale small screenshots so Tesseract can read tiny text.
  const MIN_SIDE = 1800;
  if (width > 0 && height > 0 && Math.min(width, height) < MIN_SIDE) {
    const scale = MIN_SIDE / Math.min(width, height);
    pipeline = pipeline.resize(
      Math.round(width * scale),
      Math.round(height * scale),
      { fit: "inside" },
    );
  }

  return pipeline.png().toBuffer();
}
import { assertDiscordCdnImageUrl } from "../../network-security.js";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15_000;
