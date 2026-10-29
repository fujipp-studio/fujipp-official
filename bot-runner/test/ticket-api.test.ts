import assert from 'node:assert/strict';
import test from 'node:test';
import { RuntimeApiClient } from '../src/api-client.js';
import type { TicketState } from '../src/features/ticket/config.js';

test('ticket record and archive requests carry installation scope and runner authentication', async t => {
  const calls: Array<{ url: URL; options: RequestInit }> = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL, options: RequestInit) => {
    const url = new URL(input);
    calls.push({ url, options });
    return options.method === 'GET' ? new Response('[]', { status: 200 }) : new Response(null, { status: 204 });
  });
  const api = new RuntimeApiClient('https://backend.test', 'private-runner-token');
  assert.deepEqual(await api.ticketList('bot', 'installation'), []);
  const state: TicketState = { ownerId: '111111111111111111', categoryKey: 'order', openedAt: 1790000000000, autoCloseMinutes: 0, autoCloseMode: 'IDLE', supportRoleIds: [], status: 'OPEN' };
  await api.ticketSave('bot', 'installation', '222222222222222222', 'ticket', state);
  await api.ticketArchive('bot', 'installation', '222222222222222222', []);
  assert.equal(calls[0]!.url.searchParams.get('installationId'), 'installation');
  assert.equal(calls[1]!.url.pathname, '/internal/v1/runtime/bots/bot/tickets/222222222222222222');
  assert.equal(calls[2]!.url.pathname.endsWith('/archive'), true);
  assert.deepEqual(JSON.parse(String(calls[1]!.options.body)), { installationId: 'installation', name: 'ticket', state });
  assert.deepEqual(JSON.parse(String(calls[2]!.options.body)), { installationId: 'installation', messages: [] });
  for (const call of calls) assert.equal(new Headers(call.options.headers).get('X-Runner-Token'), 'private-runner-token');
});
