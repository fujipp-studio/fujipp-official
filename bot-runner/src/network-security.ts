import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const PRIVATE_IPV4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^224\./,
  /^2(?:2[5-9]|3\d)\./,
];

export function isPrivateNetworkAddress(address: string): boolean {
  if (isIP(address) === 4) return PRIVATE_IPV4.some((pattern) => pattern.test(address));
  if (isIP(address) !== 6) return false;
  const normalized = address.toLowerCase().split("%")[0] ?? address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc")
    || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("ff") || normalized.startsWith("2001:db8:")
    || normalized.startsWith("::ffff:") && isPrivateNetworkAddress(normalized.slice(7));
}

export async function assertPublicPostgresUrl(rawUrl: string): Promise<URL> {
  return (await resolvePublicPostgresUrl(rawUrl)).url;
}

export async function resolvePublicPostgresUrl(rawUrl: string): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("SPENDING_DB_URL must be a valid PostgreSQL connection URL");
  }
  if (!/^postgres(?:ql):$/.test(url.protocol) || !url.hostname || !url.username) {
    throw new Error("SPENDING_DB_URL must be a PostgreSQL URL with a hostname and username");
  }
  if (url.hostname.toLowerCase() === "localhost" || isPrivateNetworkAddress(url.hostname)) {
    throw new Error("SPENDING_DB_URL must not target localhost or a private network");
  }
  const resolved = await lookup(url.hostname, { all: true, verbatim: true });
  if (resolved.length === 0 || resolved.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new Error("SPENDING_DB_URL resolved to a private or unavailable network address");
  }
  return { url, addresses: [...new Set(resolved.map(({ address }) => address))] };
}

export function assertDiscordCdnImageUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Image URL is invalid");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || !["cdn.discordapp.com", "media.discordapp.net"].includes(host)) {
    throw new Error("Only Discord CDN image attachments are accepted");
  }
  return url;
}
