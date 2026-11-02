// Customer wallets (`client.customers.addWallet` / `removeWallet`, and the same on a
// `Customer`) and the activity series (`client.analytics.series`). Offline: an
// injected `fetch` answers every call.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, Customer } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

const STELLAR = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';
const SOLANA = '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV';

function fakeWallet(overrides = {}) {
  return {
    id: 'cw_1',
    chain: 'stellar',
    address: STELLAR,
    label: null,
    createdAt: '2026-06-21T12:34:56.000Z',
    ...overrides,
  };
}

function fakeCustomer(overrides = {}) {
  return {
    id: 'cus_1',
    name: 'Acme Inc.',
    alias: null,
    note: null,
    email: 'billing@acme.com',
    wallets: [fakeWallet()],
    account: STELLAR,
    reference: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── client.customers wallets ────────────────────────────────────────────────

test('addWallet POSTs the wallet to /customers/:id/wallets', async () => {
  const { client, fetch } = makeClient(() =>
    fakeWallet({ id: 'cw_2', chain: 'solana', address: SOLANA, label: 'Phantom' }),
  );

  const wallet = await client.customers.addWallet('cus_1', {
    chain: 'solana',
    address: SOLANA,
    label: 'Phantom',
  });

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/customers\/cus_1\/wallets$/);
  assert.deepEqual(call.body, { chain: 'solana', address: SOLANA, label: 'Phantom' });
  assert.equal(wallet.id, 'cw_2');
  assert.equal(wallet.chain, 'solana');
});

test('removeWallet DELETEs /customers/:id/wallets/:walletId with no body', async () => {
  const { client, fetch } = makeClient(() => ({ id: 'cw_1', deleted: true }));

  const result = await client.customers.removeWallet('cus_1', 'cw_1');

  const call = fetch.calls[0];
  assert.equal(call.method, 'DELETE');
  assert.match(call.url, /\/v1\/customers\/cus_1\/wallets\/cw_1$/);
  assert.equal(call.body, undefined);
  assert.deepEqual(result, { id: 'cw_1', deleted: true });
});

test('create sends wallets in the body', async () => {
  const { client, fetch } = makeClient(() => fakeCustomer());

  const customer = await client.customers.create({
    name: 'Acme Inc.',
    wallets: [{ chain: 'stellar', address: STELLAR }],
  });

  assert.deepEqual(fetch.calls[0].body, {
    name: 'Acme Inc.',
    wallets: [{ chain: 'stellar', address: STELLAR }],
  });
  assert.ok(customer instanceof Customer);
  assert.equal(customer.wallets.length, 1);
  assert.equal(customer.wallets[0].address, STELLAR);
});

test('a Customer adds a wallet to itself and keeps account on the first wallet', async () => {
  const { client, fetch } = makeClient((url, init) => {
    if (init.method === 'POST') return fakeWallet({ id: 'cw_2', chain: 'solana', address: SOLANA });
    return fakeCustomer({ wallets: [], account: null });
  });

  const customer = await client.customers.fetch('cus_1');
  assert.equal(customer.account, null);

  await customer.addWallet({ chain: 'solana', address: SOLANA });

  assert.match(fetch.calls[1].url, /\/v1\/customers\/cus_1\/wallets$/);
  assert.deepEqual(fetch.calls[1].body, { chain: 'solana', address: SOLANA });
  assert.deepEqual(customer.wallets.map((w) => w.id), ['cw_2']);
  assert.equal(customer.account, SOLANA);
});

test('a wallet the customer already holds is not listed twice', async () => {
  const { client } = makeClient((url, init) =>
    init.method === 'POST' ? fakeWallet() : fakeCustomer(),
  );

  const customer = await client.customers.fetch('cus_1');
  await customer.addWallet({ chain: 'stellar', address: STELLAR });

  assert.equal(customer.wallets.length, 1);
});

test('a Customer removes a wallet by id or by the wallet itself', async () => {
  const { client, fetch } = makeClient((url, init) => {
    if (init.method === 'DELETE') return { id: url.split('/').pop(), deleted: true };
    return fakeCustomer({
      wallets: [fakeWallet(), fakeWallet({ id: 'cw_2', chain: 'solana', address: SOLANA })],
    });
  });

  const customer = await client.customers.fetch('cus_1');
  await customer.removeWallet(customer.wallets[0]);

  assert.equal(fetch.calls[1].method, 'DELETE');
  assert.match(fetch.calls[1].url, /\/v1\/customers\/cus_1\/wallets\/cw_1$/);
  assert.deepEqual(customer.wallets.map((w) => w.id), ['cw_2']);
  assert.equal(customer.account, SOLANA);

  await customer.removeWallet('cw_2');
  assert.match(fetch.calls[2].url, /\/wallets\/cw_2$/);
  assert.deepEqual(customer.wallets, []);
  assert.equal(customer.account, null);
});

// ── client.analytics.series ─────────────────────────────────────────────────

function fakeSeries(period = 'day') {
  const counts = { count: 0, succeeded: 0, failed: 0 };
  return {
    period,
    buckets: [{ start: '2026-10-01', count: 31, succeeded: 27, failed: 3, volume: '1842.5', volumeUsd: '1790.36' }],
    totals: { count: 31, succeeded: 27, failed: 3, volume: '1842.5', volumeUsd: '1790.36', unpriced: 0, payers: 9 },
    previous: { count: 0, succeeded: 0, failed: 0, volume: '0', volumeUsd: '0.00', unpriced: 0 },
    swaps: {
      buckets: [{ start: '2026-10-01', ...counts, volumeUsd: '0.00' }],
      totals: { ...counts, inProgress: 0, byKind: { dex: 0, chain: 0, crossChain: 0, usdt0: 0 }, volumeUsd: '0.00', unpriced: 0 },
      previous: { ...counts, volumeUsd: '0.00' },
    },
    liquidity: { buckets: [{ start: '2026-10-01', ...counts }], totals: counts, previous: counts },
    webhooks: {
      buckets: [{ start: '2026-10-01', deliveries: 0, failed: 0 }],
      totals: { deliveries: 0, failed: 0 },
      previous: { deliveries: 0, failed: 0 },
    },
    zkPayments: {
      buckets: [{ start: '2026-10-01', count: 1, succeeded: 1, expired: 0, volume: '10', volumeUsd: '2.50' }],
      totals: { count: 1, succeeded: 1, expired: 0, volume: '10', volumeUsd: '2.50', fees: '0.018', feesUsd: '0.00' },
      previous: { count: 0, succeeded: 0, expired: 0, volume: '0', volumeUsd: '0.00', fees: '0', feesUsd: '0.00' },
    },
  };
}

test('series GETs /summary/series with the period in the query', async () => {
  const { client, fetch } = makeClient(() => fakeSeries('month'));

  const series = await client.analytics.series({ period: 'month' });

  const call = fetch.calls[0];
  assert.equal(call.method, 'GET');
  const url = new URL(call.url);
  assert.equal(url.pathname, '/v1/summary/series');
  assert.equal(url.searchParams.get('period'), 'month');
  assert.equal(call.body, undefined);
  assert.equal(series.period, 'month');
  assert.equal(series.totals.payers, 9);
  assert.equal(series.zkPayments.totals.fees, '0.018');
});

test('series without a period leaves the server default (no query)', async () => {
  const { client, fetch } = makeClient(() => fakeSeries());

  await client.analytics.series();

  const url = new URL(fetch.calls[0].url);
  assert.equal(url.pathname, '/v1/summary/series');
  assert.equal(url.search, '');
});
