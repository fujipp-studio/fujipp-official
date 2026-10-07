import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import test from "node:test";
import { Client } from "pg";
import { createPostgresSocket, postgresConnectionError } from "../src/features/member-spending/postgres-connection.js";

test("pg connects once to a checked IPv4 address without resolving the hostname again", async (t) => {
  let connections = 0;
  const server = createServer((socket) => {
    connections++;
    socket.once("data", () => socket.end());
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = new URL(`postgresql://user:secret@spending.invalid:${(server.address() as AddressInfo).port}/postgres`);
  const socket = createPostgresSocket(url, ["2406:da18:17a4:5428:fd4b:954e:1f8f:ea73", "127.0.0.1"]);
  t.after(() => {
    socket.destroy();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });
  assert.equal(socket.connecting, false);
  assert.equal(socket.pending, true);
  const client = new Client({ connectionString: url.toString(), stream: () => socket, connectionTimeoutMillis: 1000 });
  // The minimal server closes after TCP connects; no real DB or credentials are used.
  await assert.rejects(client.connect(), /Connection terminated unexpectedly/);
  assert.equal(connections, 1);
  assert.equal(client.host, "spending.invalid");
});

test("tries another checked address when the first endpoint is unavailable", async (t) => {
  const server = createServer((socket) => socket.resume());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const socket = createPostgresSocket(new URL(`postgresql://user@spending.invalid:${port}/postgres`), ["127.0.0.2", "127.0.0.1"]);
  t.after(() => {
    socket.destroy();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const connected = once(socket, "connect");
  // pg's arguments cannot redirect the pinned stream to another host or port.
  socket.connect(1, "other.invalid");
  await connected;
  assert.equal(socket.remoteAddress, "127.0.0.1");
  assert.equal(socket.remotePort, port);
  assert.equal(socket.autoSelectFamilyAttemptedAddresses.length, 2);
});

test("IPv6-only unreachable errors explain how to use an IPv4 endpoint", () => {
  const cause = Object.assign(new Error("connect ENETUNREACH"), { code: "ENETUNREACH" });
  for (const error of [cause, new AggregateError([cause])]) {
    const result = postgresConnectionError(error, ["2606:4700:4700::1111"]);
    assert.ok(result instanceof Error);
    assert.match(result.message, /IPv6.*SPENDING_DB_URL.*IPv4.*Session pooler/);
    assert.equal(result.cause, error);
  }
});

test("authentication and other connection failures keep their original errors", () => {
  const authError = Object.assign(new Error("password authentication failed"), { code: "28P01" });
  const networkError = Object.assign(new Error("network unreachable"), { code: "ENETUNREACH" });
  assert.equal(postgresConnectionError(authError, ["2606:4700:4700::1111"]), authError);
  assert.equal(postgresConnectionError(networkError, ["8.8.8.8"]), networkError);
  assert.equal(postgresConnectionError(new AggregateError([networkError, authError]), ["2606:4700:4700::1111"]) instanceof AggregateError, true);
});
