import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, Webhooks, WebhookSignatureError } from '../dist/index.js';
import { mockFetch, signWebhook, fakeIntent } from './helpers.mjs';

const SECRET = 'whsec_test_secret';

function eventBody(type = 'PAYMENT_INTENT_SUCCEEDED') {
  return JSON.stringify({
    id: 'evt_1',
    type,
    createdAt: '2026-01-01T00:00:00.000Z',
    data: fakeIntent({ status: 'SUCCEEDED' }),
  });
}

test('Webhooks.verify accepts a correctly signed body', () => {
  const body = eventBody();
  const { header } = signWebhook(body, SECRET);
  assert.equal(Webhooks.verify(body, header, SECRET), true);
});

test('Webhooks.verify rejects a tampered body', () => {
  const { header } = signWebhook(eventBody(), SECRET);
  assert.throws(
    () => Webhooks.verify(eventBody('PAYMENT_INTENT_FAILED'), header, SECRET),
    WebhookSignatureError,
  );
});

test('Webhooks.verify rejects the wrong secret', () => {
  const body = eventBody();
  const { header } = signWebhook(body, SECRET);
  assert.throws(() => Webhooks.verify(body, header, 'whsec_wrong'), WebhookSignatureError);
});

test('Webhooks.verify rejects a missing/malformed header', () => {
  assert.throws(() => Webhooks.verify(eventBody(), null, SECRET), /Missing signature/);
  assert.throws(() => Webhooks.verify(eventBody(), 'garbage', SECRET), /Malformed/);
});

test('Webhooks.verify enforces the replay tolerance window', () => {
  const body = eventBody();
  const old = Math.floor(Date.now() / 1000) - 10_000;
  const { header } = signWebhook(body, SECRET, old);

  assert.throws(() => Webhooks.verify(body, header, SECRET), /tolerance/);
  // disabling the check (tolerance 0) lets the old timestamp through
  assert.equal(Webhooks.verify(body, header, SECRET, { toleranceSeconds: 0 }), true);
});

test('Webhooks.constructEvent verifies and parses the JSON event', () => {
  const body = eventBody();
  const { header } = signWebhook(body, SECRET);

  const event = Webhooks.constructEvent(body, header, SECRET);
  assert.equal(event.type, 'PAYMENT_INTENT_SUCCEEDED');
  assert.equal(event.data.status, 'SUCCEEDED');
});

test('verify works on a Buffer (raw) body, not just a string', () => {
  const body = eventBody();
  const buf = Buffer.from(body, 'utf8');
  const { header } = signWebhook(buf, SECRET);
  assert.equal(Webhooks.verify(buf, header, SECRET), true);
});

test('client.webhooks.process dispatches to on() listeners (raw, camelCase, event)', () => {
  const client = new Client({ apiKey: 'dv_test', webhookSecret: SECRET, fetch: mockFetch(() => ({})) });

  const fired = [];
  client.webhooks.on('PAYMENT_INTENT_SUCCEEDED', (e) => fired.push(['raw', e.type]));
  client.webhooks.on('paymentIntentSucceeded', (e) => fired.push(['camel', e.data.id]));
  client.webhooks.on('event', (e) => fired.push(['any', e.type]));

  const body = eventBody();
  const { header } = signWebhook(body, SECRET);
  const event = client.webhooks.process(body, header);

  assert.equal(event.type, 'PAYMENT_INTENT_SUCCEEDED');
  assert.deepEqual(fired, [
    ['raw', 'PAYMENT_INTENT_SUCCEEDED'],
    ['camel', 'pi_test_123'],
    ['any', 'PAYMENT_INTENT_SUCCEEDED'],
  ]);
});

test('client.webhooks.process throws on a bad signature and fires nothing', () => {
  const client = new Client({ apiKey: 'dv_test', webhookSecret: SECRET, fetch: mockFetch(() => ({})) });

  let fired = 0;
  client.webhooks.on('event', () => (fired += 1));

  assert.throws(() => client.webhooks.process(eventBody(), 'garbage'), WebhookSignatureError);
  assert.equal(fired, 0);
});

test('client.webhooks.process requires a configured secret', () => {
  const client = new Client({ apiKey: 'dv_test', fetch: mockFetch(() => ({})) });
  const body = eventBody();
  const { header } = signWebhook(body, SECRET);

  assert.throws(() => client.webhooks.process(body, header), /No webhook secret/);
  // ...but an explicit per-call secret works
  assert.doesNotThrow(() => client.webhooks.process(body, header, { secret: SECRET }));
});
