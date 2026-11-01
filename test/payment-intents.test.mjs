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

test('createPay sends `chain` for Solana and Monad links, and the intent names its chain', async () => {
  const { client, fetch } = makeClient(() =>
    fakeIntent({ kind: 'PAY', chain: 'solana', destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', asset: 'native' }),
  );

  const intent = await client.paymentIntents.createPay({
    chain: 'solana',
    destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    amount: '0.5',
  });

  assert.deepEqual(fetch.calls[0].body, { chain: 'solana', destination: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', amount: '0.5' });
  assert.equal(intent.chain, 'solana');
  assert.equal(intent.assetLabel, 'SOL');
  assert.equal(intent.toJSON().chain, 'solana');
});

test('an intent from a server that omits `chain` is a Stellar one', async () => {
  const { client } = makeClient(() => {
    const { chain, ...older } = fakeIntent();
    return older;
  });
  const intent = await client.paymentIntents.fetch('pi_test_123');
  assert.equal(intent.chain, 'stellar');
  assert.equal(intent.assetLabel, 'XLM');
});

test('a Monad intent labels its native coin MON', async () => {
  const { client } = makeClient(() => fakeIntent({ chain: 'monad', asset: 'native' }));
  const intent = await client.paymentIntents.fetch('pi_test_123');
  assert.equal(intent.assetLabel, 'MON');
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

test('list filters by chain and creation date (a Date becomes ISO 8601)', async () => {
  const { client, fetch } = makeClient(() => ({ data: [], total: 0, take: 20, skip: 0 }));
  await client.paymentIntents.list({ chain: 'monad', createdFrom: new Date('2026-11-01T00:00:00.000Z') });
  await client.paymentIntents.list({ createdFrom: '2026-10-01T00:00:00Z' });
  assert.match(fetch.calls[0].url, /chain=monad/);
  assert.match(fetch.calls[0].url, /createdFrom=2026-11-01T00%3A00%3A00.000Z/);
  assert.match(fetch.calls[1].url, /createdFrom=2026-10-01T00%3A00%3A00Z/);
  assert.doesNotMatch(fetch.calls[1].url, /chain=/);
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
