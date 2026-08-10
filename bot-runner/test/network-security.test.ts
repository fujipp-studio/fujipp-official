import assert from "node:assert/strict";
import test from "node:test";
import { assertDiscordCdnImageUrl, isPrivateNetworkAddress } from "../src/network-security.js";

test("private and special-use network addresses are rejected", () => {
  for (const address of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "192.168.1.2", "169.254.169.254", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateNetworkAddress(address), true, address);
  }
  assert.equal(isPrivateNetworkAddress("8.8.8.8"), false);
  assert.equal(isPrivateNetworkAddress("2606:4700:4700::1111"), false);
});

test("image downloads only accept the Discord CDN over HTTPS", () => {
  assert.equal(assertDiscordCdnImageUrl("https://cdn.discordapp.com/attachments/1/2/a.png").hostname, "cdn.discordapp.com");
  assert.equal(assertDiscordCdnImageUrl("https://media.discordapp.net/attachments/1/2/a.png").hostname, "media.discordapp.net");
  assert.throws(() => assertDiscordCdnImageUrl("http://cdn.discordapp.com/a.png"));
  assert.throws(() => assertDiscordCdnImageUrl("https://127.0.0.1/a.png"));
  assert.throws(() => assertDiscordCdnImageUrl("https://example.com/a.png"));
});
