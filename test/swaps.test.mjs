import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, Swap } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

/** A minimal fake swap payload the API would return. */
function fakeSwap(overrides = {}) {
  return {
    id: 'swap_test_123',
    status: 'PENDING',
    network: 'testnet',
    source: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    sendAsset: 'native',
    sendAssetIssuer: null,
    sendAmount: '100',
    feeAmount: '0.5',
    feeBps: 50,
    swapAmount: '99.5',
    destAsset: 'USDC',
    destAssetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    destEstimated: '98.7',
    destMin: '97.0',
    slippageBps: 100,
    path: [{ code: 'native', issuer: null }],
    memo: '999',
    xdr: 'AAAA',
    uri: 'web+stellar:tx?xdr=AAAA',
    txHash: '',
    qr: 'data:image/png;base64,AAAA',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A fake quote payload (plain pricing object, not a Swap). */
function fakeQuote(overrides = {}) {
  return {
    network: 'testnet',
    source: { asset: 'native', issuer: null, amount: '100' },
    fee: { asset: 'native', issuer: null, amount: '0.5', bps: 50, wallet: null },
    swap: { asset: 'native', issuer: null, amount: '99.5' },
    destination: {
      asset: 'USDC',
      issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
      estimated: '98.7',
      minimum: '97.0',
      slippageBps: 100,
    },
    path: [{ code: 'native', issuer: null }],
    ...overrides,
  };
}

test('quote POSTs to /swaps/quote and returns a plain object (not a Swap)', async () => {
  const { client, fetch } = makeClient(() => fakeQuote());

  const quote = await client.swaps.quote({
    amount: '100',
    destAssetCode: 'USDC',
    slippageBps: 100,
  });

  assert.ok(!(quote instanceof Swap));
  assert.equal(quote.network, 'testnet');
  assert.equal(quote.destination.minimum, '97.0');
  assert.equal(quote.fee.bps, 50);

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/swaps\/quote$/);
  assert.deepEqual(call.body, {
    amount: '100',
    destAssetCode: 'USDC',
    slippageBps: 100,
  });
});

test('create POSTs to /swaps with the options body and returns a Swap', async () => {
  const { client, fetch } = makeClient(() => fakeSwap());

  const swap = await client.swaps.create({
    amount: '100',
    destAssetCode: 'USDC',
    source: 'G...SRC',
    destination: 'G...DEST',
    memo: '999',
  });

  assert.ok(swap instanceof Swap);
  assert.equal(swap.sendAssetLabel, 'XLM');
  assert.equal(swap.destAssetLabel, 'USDC');
  assert.equal(swap.isPending, true);

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/swaps$/);
  assert.deepEqual(call.body, {
    amount: '100',
    destAssetCode: 'USDC',
    source: 'G...SRC',
    destination: 'G...DEST',
    memo: '999',
  });
});

test('fetch GETs a single swap and caches it by id', async () => {
  const { client } = makeClient(() => fakeSwap());

  const swap = await client.swaps.fetch('swap_test_123');
  assert.equal(swap.id, 'swap_test_123');
  assert.equal(client.swaps.cache.get('swap_test_123'), swap);
});

test('list maps items and returns pagination metadata + query params', async () => {
  const { client, fetch } = makeClient(() => ({
    data: [fakeSwap({ id: 'swap_a' }), fakeSwap({ id: 'swap_b' })],
    total: 2,
    take: 50,
    skip: 0,
  }));

  const page = await client.swaps.list({ status: 'SUCCEEDED', take: 50 });

  assert.equal(page.total, 2);
  assert.equal(page.items.length, 2);
  assert.ok(page.items[0] instanceof Swap);
  assert.match(fetch.calls[0].url, /status=SUCCEEDED/);
  assert.match(fetch.calls[0].url, /take=50/);
});

test('submit POSTs the signedXdr and materializes the refreshed swap', async () => {
  const { client, fetch } = makeClient(() => ({
    submitted: true,
    status: 'SUCCEEDED',
    txHash: 'abc123',
    reason: null,
    resultCodes: ['tx_success'],
    swap: fakeSwap({ status: 'SUCCEEDED', txHash: 'abc123' }),
  }));

  const outcome = await client.swaps.submit('swap_test_123', { signedXdr: 'SIGNEDAAAA' });

  assert.equal(outcome.submitted, true);
  assert.equal(outcome.status, 'SUCCEEDED');
  assert.equal(outcome.txHash, 'abc123');
  assert.deepEqual(outcome.resultCodes, ['tx_success']);
  assert.ok(outcome.swap instanceof Swap);
  assert.equal(outcome.swap.isSucceeded, true);

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/swaps\/swap_test_123\/submit$/);
  assert.deepEqual(call.body, { signedXdr: 'SIGNEDAAAA' });
});

test('swap.submit delegates to the manager and patches the instance in place', async () => {
  let seen = 0;
  const { client, fetch } = makeClient(() => {
    seen += 1;
    return seen === 1
      ? fakeSwap()
      : {
          submitted: true,
          status: 'SUCCEEDED',
          txHash: 'abc123',
          reason: null,
          resultCodes: ['tx_success'],
          swap: fakeSwap({ status: 'SUCCEEDED', txHash: 'abc123' }),
        };
  });

  const swap = await client.swaps.fetch('swap_test_123');
  const outcome = await swap.submit({ signedXdr: 'SIGNEDAAAA' });

  assert.equal(outcome.submitted, true);
  assert.equal(swap.status, 'SUCCEEDED');
  assert.equal(swap.txHash, 'abc123');
  assert.equal(fetch.calls[1].method, 'POST');
  assert.deepEqual(fetch.calls[1].body, { signedXdr: 'SIGNEDAAAA' });
});
