import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, resolveShared, DEFAULT_BASE_URL } from '../dist/index.js';
import { mockFetch, fakeIntent } from './helpers.mjs';

test('throws without an apiKey', () => {
  assert.throws(() => new Client({}), /apiKey/);
  assert.throws(() => new Client(undefined), /apiKey/);
});

test('constructs with just an apiKey and wires every manager', () => {
  const client = new Client({ apiKey: 'dv_test', fetch: mockFetch(() => ({})) });

  assert.ok(client.paymentIntents);
  assert.ok(client.webhooks);
  assert.ok(client.products);
  assert.ok(client.customers);
  assert.ok(client.analytics);
  assert.ok(client.health);
  assert.equal(Client.version, '1.0.0');
});

test('falls back to the shared gateway URL when none is given', () => {
  assert.equal(resolveShared().baseURL, DEFAULT_BASE_URL);

  const client = new Client({ apiKey: 'dv_test', fetch: mockFetch(() => ({})) });
  assert.equal(client.shared.baseURL, DEFAULT_BASE_URL);
});

test('per-client baseURL override is honored', () => {
  const client = new Client({
    apiKey: 'dv_test',
    baseURL: 'http://localhost:3000',
    fetch: mockFetch(() => ({})),
  });
  assert.equal(client.shared.baseURL, 'http://localhost:3000');
});

test('sends Authorization + apikey headers built from the apiKey', async () => {
  const fetch = mockFetch(() => fakeIntent());
  const client = new Client({ apiKey: 'dv_secret_key', baseURL: 'http://gw', fetch });

  await client.paymentIntents.fetch('pi_1');

  const { headers } = fetch.calls[0];
  assert.equal(headers['Authorization'], 'Bearer dv_secret_key');
  assert.equal(headers['apikey'], 'dv_secret_key');
  assert.match(headers['User-Agent'], /cosmospay\.js\//);
});

test('setApiKey swaps the credential for later requests', async () => {
  const fetch = mockFetch(() => fakeIntent());
  const client = new Client({ apiKey: 'old', baseURL: 'http://gw', fetch });

  client.setApiKey('new_key');
  await client.paymentIntents.fetch('pi_1');

  assert.equal(fetch.calls[0].headers['Authorization'], 'Bearer new_key');
});

test('re-emits REST telemetry as request/response events', async () => {
  const fetch = mockFetch(() => fakeIntent());
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });

  const events = [];
  client.on('request', (p) => events.push(['request', p.method]));
  client.on('response', (p) => events.push(['response', p.status]));

  await client.paymentIntents.fetch('pi_1');

  assert.deepEqual(events, [
    ['request', 'GET'],
    ['response', 200],
  ]);
});

test('extra headers are merged into every request', async () => {
  const fetch = mockFetch(() => fakeIntent());
  const client = new Client({
    apiKey: 'dv_test',
    baseURL: 'http://gw',
    headers: { 'X-Trace': 'abc' },
    fetch,
  });

  await client.paymentIntents.fetch('pi_1');
  assert.equal(fetch.calls[0].headers['X-Trace'], 'abc');
});
