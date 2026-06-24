import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, PaymentIntent } from '../dist/index.js';
import { mockFetch, fakeIntent } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

test('createPay POSTs to /payment-intents/pay with the options body', async () => {
  const { client, fetch } = makeClient(() => fakeIntent({ kind: 'PAY' }));

  const intent = await client.paymentIntents.createPay({
    destination: 'G...DEST',
    amount: '12.5',
    msg: 'Coffee',
  });

  assert.ok(intent instanceof PaymentIntent);
  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/payment-intents\/pay$/);
  assert.deepEqual(call.body, { destination: 'G...DEST', amount: '12.5', msg: 'Coffee' });
});

test('createTx POSTs to /payment-intents/tx', async () => {
  const { client, fetch } = makeClient(() =>
    fakeIntent({ kind: 'TX', source: 'G...SRC', xdr: 'AAAA' }),
  );

  const tx = await client.paymentIntents.createTx({
    source: 'G...SRC',
    destination: 'G...DEST',
    amount: '25.5',
  });

  assert.equal(tx.isTx, true);
  assert.equal(tx.xdr, 'AAAA');
  assert.match(fetch.calls[0].url, /\/v1\/payment-intents\/tx$/);
});

test('fetch GETs a single intent and caches it by id', async () => {
  const { client } = makeClient(() => fakeIntent());

  const intent = await client.paymentIntents.fetch('pi_test_123');
  assert.equal(intent.id, 'pi_test_123');
  assert.equal(client.paymentIntents.cache.get('pi_test_123'), intent);
});

test('list maps items and returns pagination metadata + query params', async () => {
  const { client, fetch } = makeClient(() => ({
    data: [fakeIntent({ id: 'pi_a' }), fakeIntent({ id: 'pi_b' })],
    total: 2,
    take: 50,
    skip: 0,
  }));

  const page = await client.paymentIntents.list({ status: 'SUCCEEDED', take: 50 });

  assert.equal(page.total, 2);
  assert.equal(page.items.length, 2);
  assert.ok(page.items[0] instanceof PaymentIntent);
  assert.match(fetch.calls[0].url, /status=SUCCEEDED/);
  assert.match(fetch.calls[0].url, /take=50/);
});

test('validate POSTs the txHash and materializes the refreshed intent', async () => {
  const { client, fetch } = makeClient(() => ({
    valid: true,
    status: 'SUCCEEDED',
    reason: null,
    paymentIntent: fakeIntent({ status: 'SUCCEEDED', txHash: 'abc123' }),
  }));

  const outcome = await client.paymentIntents.validate('pi_test_123', { txHash: 'abc123' });

  assert.equal(outcome.valid, true);
  assert.equal(outcome.status, 'SUCCEEDED');
  assert.ok(outcome.paymentIntent instanceof PaymentIntent);
  assert.equal(outcome.paymentIntent.isSucceeded, true);

  const call = fetch.calls[0];
  assert.match(call.url, /\/payment-intents\/pi_test_123\/validate$/);
  assert.deepEqual(call.body, { txHash: 'abc123' });
});

test('intent.edit PATCHes and patches the instance in place', async () => {
  let seen = 0;
  const { client, fetch } = makeClient(() => {
    seen += 1;
    return seen === 1 ? fakeIntent() : fakeIntent({ reference: 'order_1234' });
  });

  const intent = await client.paymentIntents.fetch('pi_test_123');
  await intent.edit({ reference: 'order_1234' });

  assert.equal(intent.reference, 'order_1234');
  assert.equal(fetch.calls[1].method, 'PATCH');
  assert.deepEqual(fetch.calls[1].body, { reference: 'order_1234' });
});

test('intent.delete DELETEs and evicts the cache entry', async () => {
  const { client, fetch } = makeClient((url, init) =>
    init.method === 'DELETE' ? { id: 'pi_test_123', deleted: true } : fakeIntent(),
  );

  const intent = await client.paymentIntents.fetch('pi_test_123');
  const result = await intent.delete();

  assert.deepEqual(result, { id: 'pi_test_123', deleted: true });
  assert.equal(client.paymentIntents.cache.has('pi_test_123'), false);
  assert.equal(fetch.calls[1].method, 'DELETE');
});
