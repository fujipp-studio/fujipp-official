import type { PromptPaySession } from "../../types.js";

const PNG_HEADER = Buffer.from([137,80,78,71,13,10,26,10]);
const FILE_NAME = "promptpay-qr.png";

export function promptPayQrImage(session: PromptPaySession) {
  // Older backends still return only the public image URL during rolling deploys.
  if (session.qrImageDataUri === undefined) return { url: session.qrUrl, files: [] };
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(session.qrImageDataUri);
  if (!match || match[1]!.length > 350_000) throw new Error("ระบบสร้างรูป QR ไม่สำเร็จ กรุณาลองใหม่");
  const png = Buffer.from(match[1]!, "base64");
  if (png.length <= PNG_HEADER.length || !png.subarray(0,PNG_HEADER.length).equals(PNG_HEADER))
    throw new Error("รูป QR ไม่ใช่ไฟล์ PNG ที่ถูกต้อง กรุณาลองใหม่");
  return { url: `attachment://${FILE_NAME}`, files: [{ attachment: png, name: FILE_NAME }] };
}
