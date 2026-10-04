import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, AliasManager, AssetManager } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function client(handler) {
  const fetch = mockFetch(handler);
  return { c: new Client({ apiKey: 'k', baseURL: 'http://gw', fetch }), fetch };
}

test('the client exposes aliases and assets', () => {
  const { c } = client(() => ({}));
  assert.ok(c.aliases instanceof AliasManager);
  assert.ok(c.assets instanceof AssetManager);
});

test('aliases.resolve encodes the handle and passes the network', async () => {
  const { c, fetch } = client(() => ({ name: 'ada', displayName: 'Ada', addresses: [] }));
  await c.aliases.resolve('ada/../x', { network: 'public' });
  assert.equal(fetch.calls[0].method, 'GET');
  assert.equal(fetch.calls[0].url, 'http://gw/v1/aliases/resolve/ada%2F..%2Fx?network=public');
});

test('aliases.claim posts the signed challenge as-is', async () => {
  const { c, fetch } = client(() => ({ id: 'a1', name: 'ada', addresses: [] }));
  const body = { name: 'ada', email: 'ada@example.com', nonce: 'n', signature: 'sig' };
  await c.aliases.claim(body);
  assert.equal(fetch.calls[0].method, 'POST');
  assert.equal(fetch.calls[0].url, 'http://gw/v1/aliases');
  assert.deepEqual(fetch.calls[0].body, body);
});

test('aliases address and recovery routes hit the documented paths', async () => {
  const { c, fetch } = client(() => ({}));
  await c.aliases.createChallenge({ name: 'ada', address: 'G', network: 'public', purpose: 'ADD_ADDRESS' });
  await c.aliases.addAddress('ada', { address: 'G', network: 'public', nonce: 'n', signature: 's' });
  await c.aliases.removeAddress('ada', 'addr_1');
  await c.aliases.release('ada');
  await c.aliases.completeRecovery('ada', { token: 't', address: 'G', network: 'public', nonce: 'n', signature: 's' });
  await c.aliases.availability('ada');
  await c.aliases.byAddress('GABC', { network: 'testnet' });
  await c.aliases.list({ take: 10 });
  assert.deepEqual(
    fetch.calls.map((x) => `${x.method} ${new URL(x.url).pathname}`),
    [
      'POST /v1/aliases/challenges',
      'POST /v1/aliases/ada/addresses',
      'DELETE /v1/aliases/ada/addresses/addr_1',
      'DELETE /v1/aliases/ada',
      'POST /v1/aliases/ada/recovery/complete',
      'GET /v1/aliases/availability/ada',
      'GET /v1/aliases/by-address/GABC',
      'GET /v1/aliases',
    ],
  );
});

test('assets.list sends the filters as query parameters', async () => {
  const { c, fetch } = client(() => ({ network: 'public', version: 3, data: [] }));
  const res = await c.assets.list({ network: 'public', verified: true });
  assert.equal(fetch.calls[0].url, 'http://gw/v1/assets?network=public&verified=true');
  assert.equal(res.version, 3);
});

test('paymentIntents.transitions reads the history', async () => {
  const { c, fetch } = client(() => [{ id: 't1', intentId: 'pi_1', fromStatus: 'PENDING', toStatus: 'SUCCEEDED' }]);
  const rows = await c.paymentIntents.transitions('pi_1');
  assert.equal(fetch.calls[0].url, 'http://gw/v1/payment-intents/pi_1/transitions');
  assert.equal(rows[0].toStatus, 'SUCCEEDED');
});
