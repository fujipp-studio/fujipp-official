import { isIP, Socket } from "node:net";

// pg calls connect(port, host) on its stream. Start disconnected and pin that
// call to the addresses already checked by resolvePublicPostgresUrl.
export function createPostgresSocket(url: URL, addresses: string[]): Socket {
  const resolved = addresses.map((address) => ({ address, family: isIP(address) }))
    .sort((a, b) => a.family - b.family);

  return new class extends Socket {
    override connect(): this {
      return super.connect({
        host: url.hostname,
        port: Number(url.port || 5432),
        autoSelectFamily: true,
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, resolved);
          else callback(null, resolved[0]!.address, resolved[0]!.family);
        },
      });
    }
  }();
}

export function postgresConnectionError(error: unknown, addresses: string[]): unknown {
  if (addresses.every((address) => isIP(address) === 6) && isUnreachable(error)) {
    return new Error(
      "เชื่อมต่อฐานข้อมูลผ่าน IPv6 ไม่ได้ กรุณาเปลี่ยน SPENDING_DB_URL เป็นปลายทางที่รองรับ IPv4 หากใช้ Supabase ให้คัดลอก URL ของ Session pooler จากหน้า Connect",
      { cause: error },
    );
  }
  return error;
}

function isUnreachable(error: unknown): boolean {
  if (error instanceof AggregateError) return error.errors.length > 0 && error.errors.every(isUnreachable);
  return error instanceof Error && "code" in error && ["ENETUNREACH", "EHOSTUNREACH"].includes(String(error.code));
}
