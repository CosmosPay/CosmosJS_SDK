// Plugins, DeFindex, the shared public key, alias recovery by email, and the
// webhook events beyond payment intents. Offline: an injected `fetch` answers
// every call.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, WebhookEventType } from '../dist/index.js';
import { mockFetch, signWebhook } from './helpers.mjs';

function makeClient(handler, extra = {}) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch, ...extra });
  return { client, fetch };
}

test('installing a plugin is a PUT carrying the consented capabilities', async () => {
  const { client, fetch } = makeClient(() => ({ slug: 'invoices', installation: {} }));

  await client.plugins.install('invoices', { grantCapabilities: ['storage'] });
  await client.plugins.uninstall('invoices');

  assert.equal(fetch.calls[0].method, 'PUT');
  assert.match(fetch.calls[0].url, /\/v1\/plugins\/invoices\/installation$/);
  assert.deepEqual(fetch.calls[0].body, { grantCapabilities: ['storage'] });
  assert.equal(fetch.calls[1].method, 'DELETE');
});

test('queries and commands are separate routes, input wrapped', async () => {
  const { client, fetch } = makeClient(() => ({ plugin: 'invoices', action: 'x', output: 1 }));

  await client.plugins.query('invoices', 'list', { status: 'open' });
  await client.plugins.command('invoices', 'void', { id: 'i1' });

  assert.match(fetch.calls[0].url, /\/plugins\/invoices\/queries\/list$/);
  assert.deepEqual(fetch.calls[0].body, { input: { status: 'open' } });
  assert.match(fetch.calls[1].url, /\/plugins\/invoices\/commands\/void$/);
});

test('plugins.list unwraps the envelope', async () => {
  const { client } = makeClient(() => ({ data: [{ slug: 'a' }, { slug: 'b' }] }));
  const plugins = await client.plugins.list();
  assert.deepEqual(plugins.map((p) => p.slug), ['a', 'b']);
});

test('DeFindex: a balance names the account, a submit carries the signed XDR', async () => {
  const { client, fetch } = makeClient(() => ({}));

  await client.defindex.balance('CVAULT', 'GACCOUNT');
  await client.defindex.deposit('CVAULT', { amounts: ['1000'], caller: 'GACCOUNT' });
  await client.defindex.submit('AAAA');

  assert.match(fetch.calls[0].url, /\/defindex\/vaults\/CVAULT\/balance\?account=GACCOUNT$/);
  assert.deepEqual(fetch.calls[1].body, { amounts: ['1000'], caller: 'GACCOUNT' });
  assert.deepEqual(fetch.calls[2].body, { xdr: 'AAAA' });
});

test('the shared public key is asked for by environment', async () => {
  const { client, fetch } = makeClient(() => ({ env: 'prod', apiKey: 'pk_prod' }));
  const key = await client.publicKey.fetch('prod');
  assert.equal(key.apiKey, 'pk_prod');
  assert.match(fetch.calls[0].url, /\/v1\/public-key\?env=prod$/);
});

test('alias recovery starts with the mailbox and answers the same either way', async () => {
  const { client, fetch } = makeClient(() => ({ accepted: true }));
  const answer = await client.aliases.startRecovery('ada', 'ada@example.com');
  assert.deepEqual(answer, { accepted: true });
  assert.match(fetch.calls[0].url, /\/v1\/aliases\/ada\/recovery$/);
  assert.deepEqual(fetch.calls[0].body, { email: 'ada@example.com' });
});

test('swap and cross-chain webhooks reach their own listeners, typed by event', () => {
  const SECRET = 'whsec_test_secret';
  const { client } = makeClient(() => ({}), { webhookSecret: SECRET });
  const fired = [];
  client.webhooks.on('CROSS_CHAIN_SWAP_REFUNDED', (e) => fired.push(['raw', e.data.refundedAmount]));
  client.webhooks.on('crossChainSwapRefunded', (e) => fired.push(['camel', e.data.id]));
  client.webhooks.on('swapSucceeded', () => fired.push(['wrong']));

  const body = JSON.stringify({
    id: 'evt_1',
    type: WebhookEventType.CrossChainSwapRefunded,
    createdAt: '2026-10-02T13:00:00.000Z',
    data: { id: 'ccs_1', refundedAmount: '100' },
  });
  const { header } = signWebhook(body, SECRET);
  const event = client.webhooks.process(body, header);

  assert.equal(event.type, 'CROSS_CHAIN_SWAP_REFUNDED');
  assert.deepEqual(fired, [
    ['raw', '100'],
    ['camel', 'ccs_1'],
  ]);
});
