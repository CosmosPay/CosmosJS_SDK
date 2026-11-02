// Private payments (`client.privatePayments`, the API's `/v1/zk-payments`).
// Offline: an injected `fetch` answers every call.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, PrivatePayment, PrivatePaymentStatus } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

const MERCHANT = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';
const FEE_ACCOUNT = 'GDUYXOQZFVPDVIVBTJNUCGYQEC3XSI2LQOQ3SJWJJ6ZY4JLCJZZFGTNQ';

function fakePayment(overrides = {}) {
  return {
    id: 'pp_1',
    status: 'PENDING',
    network: 'testnet',
    tokenContract: 'CBQU5SGVPPYI5MVBVV5GYTYNHENHBY7J44WYYVDPTZ5UNK6JDEY232QX',
    amount: '25.5',
    netAmount: '25.4541',
    feeAmount: '0.0459',
    feeBps: 18,
    recipient: MERCHANT,
    feeAccount: FEE_ACCOUNT,
    payer: null,
    paymentTxHash: null,
    feeTxHash: null,
    merchantFee: null,
    merchantFeeTxHash: null,
    description: 'Order #24',
    idempotencyKey: 'order-24',
    expiresAt: '2026-10-25T15:00:00.000Z',
    settledAt: null,
    createdAt: '2026-10-25T14:00:00.000Z',
    updatedAt: '2026-10-25T14:00:00.000Z',
    ...overrides,
  };
}

test('the client wires client.privatePayments', () => {
  const { client } = makeClient(() => ({}));
  assert.ok(client.privatePayments);
});

test('create POSTs to /zk-payments and yields a PrivatePayment', async () => {
  const { client, fetch } = makeClient(() => fakePayment());

  const payment = await client.privatePayments.create({
    amount: '25.5',
    recipient: MERCHANT,
    description: 'Order #24',
    expiresInMinutes: 30,
    merchantFee: { bps: 150, wallet: FEE_ACCOUNT, paidBy: 'payer' },
  });

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/zk-payments$/);
  assert.deepEqual(call.body, {
    amount: '25.5',
    recipient: MERCHANT,
    description: 'Order #24',
    expiresInMinutes: 30,
    merchantFee: { bps: 150, wallet: FEE_ACCOUNT, paidBy: 'payer' },
  });
  assert.equal(call.headers['Idempotency-Key'], undefined);
  assert.ok(payment instanceof PrivatePayment);
  assert.equal(payment.isPending, true);
  assert.equal(payment.feeBps, 18);
  assert.ok(payment.expiresAt instanceof Date);
  assert.equal(payment.settledAt, null);
  assert.equal(client.privatePayments.cache.get('pp_1'), payment);
});

test('an idempotency key travels as the header and in the body', async () => {
  const { client, fetch } = makeClient(() => fakePayment());

  await client.privatePayments.create({
    amount: '25.5',
    recipient: MERCHANT,
    idempotencyKey: 'order-24',
  });

  const call = fetch.calls[0];
  assert.equal(call.headers['Idempotency-Key'], 'order-24');
  assert.deepEqual(call.body, { amount: '25.5', recipient: MERCHANT, idempotencyKey: 'order-24' });
});

test('list GETs /zk-payments with status, take and skip in the query', async () => {
  const { client, fetch } = makeClient(() => ({
    data: [fakePayment({ status: 'SUCCEEDED', settledAt: '2026-10-25T14:10:00.000Z' })],
    total: 1,
    take: 10,
    skip: 5,
  }));

  const page = await client.privatePayments.list({
    status: PrivatePaymentStatus.Succeeded,
    take: 10,
    skip: 5,
  });

  const call = fetch.calls[0];
  assert.equal(call.method, 'GET');
  const url = new URL(call.url);
  assert.equal(url.pathname, '/v1/zk-payments');
  assert.equal(url.searchParams.get('status'), 'SUCCEEDED');
  assert.equal(url.searchParams.get('take'), '10');
  assert.equal(url.searchParams.get('skip'), '5');
  assert.equal(page.total, 1);
  assert.equal(page.take, 10);
  assert.equal(page.skip, 5);
  assert.ok(page.items[0] instanceof PrivatePayment);
  assert.equal(page.items[0].isSucceeded, true);
  assert.ok(page.items[0].settledAt instanceof Date);
});

test('list with no options sends no query', async () => {
  const { client, fetch } = makeClient(() => ({ data: [], total: 0, take: 20, skip: 0 }));

  await client.privatePayments.list();

  assert.equal(new URL(fetch.calls[0].url).search, '');
});

test('fetch GETs /zk-payments/:id, and a PrivatePayment refreshes itself in place', async () => {
  let call = 0;
  const { client, fetch } = makeClient(() =>
    call++ === 0
      ? fakePayment()
      : fakePayment({
          status: 'SUCCEEDED',
          payer: 'GBPAYER',
          paymentTxHash: 'ab'.repeat(32),
          feeTxHash: 'cd'.repeat(32),
          settledAt: '2026-10-25T14:10:00.000Z',
        }),
  );

  const payment = await client.privatePayments.fetch('pp_1');
  const same = await payment.fetch();

  assert.equal(fetch.calls[0].method, 'GET');
  assert.match(fetch.calls[0].url, /\/v1\/zk-payments\/pp_1$/);
  assert.match(fetch.calls[1].url, /\/v1\/zk-payments\/pp_1$/);
  assert.equal(same, payment);
  assert.equal(payment.isSucceeded, true);
  assert.equal(payment.payer, 'GBPAYER');
});

test('an expired payment reads as expired', () => {
  const { client } = makeClient(() => ({}));
  const payment = new PrivatePayment(client, fakePayment({ status: 'EXPIRED' }));
  assert.equal(payment.isExpired, true);
  assert.equal(payment.isPending, false);
});

test('toJSON round-trips the raw payload', () => {
  const { client } = makeClient(() => ({}));
  const raw = fakePayment({
    merchantFee: {
      bps: 150,
      fixed: '0',
      amount: '0.3825',
      asset: 'XLM',
      wallet: FEE_ACCOUNT,
      paidBy: 'recipient',
    },
    settledAt: '2026-10-25T14:10:00.000Z',
  });
  assert.deepEqual(new PrivatePayment(client, raw).toJSON(), raw);
});

test('config GETs /zk-payments/config and returns it as is', async () => {
  const config = {
    enabled: true,
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    token: {
      contractId: 'CBQU5SGVPPYI5MVBVV5GYTYNHENHBY7J44WYYVDPTZ5UNK6JDEY232QX',
      symbol: 'XLM',
      decimals: 7,
      underlying: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
      deployedAtLedger: 5387137,
    },
    verifier: 'CAN45PFA5CVUCU3JB77IE2JNWNTRCDWMRNG55U452L3N2IOCAGOLTUVQ',
    auditorRegistry: 'CDKWSGQER4KNDTMZS2W7V4E32KSL7BVM3LBY7EBTPWZZ3SFG5CDAOLF2',
    auditorId: 0,
    feeBps: 18,
    feeAccount: FEE_ACCOUNT,
  };
  const { client, fetch } = makeClient(() => config);

  const result = await client.privatePayments.config();

  assert.equal(fetch.calls[0].method, 'GET');
  assert.match(fetch.calls[0].url, /\/v1\/zk-payments\/config$/);
  assert.deepEqual(result, config);
});
