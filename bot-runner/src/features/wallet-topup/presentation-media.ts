/** Older QR designs sometimes put the channel variable in an image field. Preserve link URLs. */
export function normalizeWalletQrMedia(value: unknown, media=false): unknown {
  if (typeof value==="string") return media?value.replace(/\{\{slip_channel_url}}/g,"{{qr_url}}"):value;
  if (Array.isArray(value)) return value.map((item)=>normalizeWalletQrMedia(item,media));
  if (value && typeof value==="object") return Object.fromEntries(Object.entries(value).map(([key,item])=>
    [key,normalizeWalletQrMedia(item,media || ["image_url","thumbnail_url","image","thumbnail","media"].includes(key))]));
  return value;
}
