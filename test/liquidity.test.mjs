// Liquidity pools — `client.liquidity`. Offline: an injected `fetch` answers every
// call, so the assertions are about the REQUEST this SDK makes (route, verb, query,
// headers, body) and the SHAPE it hands back, which is all a consumer depends on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, LiquidityOperation } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

/** A minimal but complete operation payload, as the API returns it. */
function fakeOperation(overrides = {}) {
  return {
    id: 'lp_op_test_123',
    kind: 'DEPOSIT',
    status: 'PENDING',
    network: 'testnet',
    source: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    poolId: 'a468d41d8e9b8f3c7c1a1d8e9b8f3c7c1a1d8e9b8f3c7c1a1d8e9b8f3c7c1a1d',
    assetA: 'native',
    assetAIssuer: null,
    assetB: 'USDC',
    assetBIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    amountA: '100',
    amountB: '25',
    shares: null,
    minPrice: '3.8',
    maxPrice: '4.2',
    slippageBps: 100,
    idempotencyKey: null,
    feeBps: 30,
    feeAmountA: '0.3',
    feeAmountB: '0.075',
    feeWallet: null,
    commissionMemo: null,
    xdr: 'AAAA',
    uri: 'web+stellar:tx?xdr=AAAA',
    txHash: '',
    qr: 'data:image/png;base64,AAAA',
    expiresAt: '2026-01-01T00:05:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const POOL = {
  id: 'a468d41d8e9b8f3c7c1a1d8e9b8f3c7c1a1d8e9b8f3c7c1a1d8e9b8f3c7c1a1d',
  network: 'testnet',
  feeBp: 30,
  totalTrustlines: '12',
  totalShares: '5000',
  reserves: [
    { asset: 'native', issuer: null, amount: '1000' },
    { asset: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', amount: '250' },
  ],
};

// ── Building operations ──────────────────────────────────────────────────────

test('deposit posts the two sides and materializes an operation', async () => {
  const { client, fetch } = makeClient(() => fakeOperation());
  const op = await client.liquidity.deposit({
    source: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    assetACode: 'XLM',
    assetBCode: 'USDC',
    assetBIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    maxAmountA: '100',
    maxAmountB: '25',
  });

  assert.ok(op instanceof LiquidityOperation);
  assert.equal(fetch.calls[0].method, 'POST');
  assert.match(fetch.calls[0].url, /\/v1\/liquidity-pools\/deposit$/);
  assert.equal(fetch.calls[0].body.maxAmountA, '100');
  assert.equal(op.isDeposit, true);
  assert.equal(op.isPending, true);
  assert.equal(op.xdr, 'AAAA');
  // Dates are Dates, not strings — the whole point of a structure.
  assert.ok(op.createdAt instanceof Date);
  assert.ok(op.expiresAt instanceof Date);
});

test('an idempotency key travels as BOTH the body field and the header', async () => {
  // The header is what makes a retried POST return the first operation instead of
  // building a second one against the same funds; the body field is what the
  // service persists. Sending one without the other is a retry that pays twice.
  const { client, fetch } = makeClient(() => fakeOperation({ idempotencyKey: 'key-1' }));
  await client.liquidity.deposit({
    source: 'G...',
    maxAmountA: '1',
    maxAmountB: '1',
    idempotencyKey: 'key-1',
  });
  assert.equal(fetch.calls[0].body.idempotencyKey, 'key-1');
  assert.equal(fetch.calls[0].headers['Idempotency-Key'], 'key-1');
});

test('no idempotency key means no header at all', async () => {
  const { client, fetch } = makeClient(() => fakeOperation());
  await client.liquidity.deposit({ source: 'G...', maxAmountA: '1', maxAmountB: '1' });
  assert.equal('Idempotency-Key' in fetch.calls[0].headers, false);
  assert.equal('idempotencyKey' in fetch.calls[0].body, false);
});

test('withdraw names the pool and the shares to burn', async () => {
  const { client, fetch } = makeClient(() => fakeOperation({ kind: 'WITHDRAW', shares: '10' }));
  const op = await client.liquidity.withdraw({ source: 'G...', poolId: POOL.id, shares: '10' });
  assert.match(fetch.calls[0].url, /\/liquidity-pools\/withdraw$/);
  assert.equal(fetch.calls[0].body.poolId, POOL.id);
  assert.equal(op.isDeposit, false);
  assert.equal(op.shares, '10');
});

// ── Reading ──────────────────────────────────────────────────────────────────

test('positions are fetched for one account', async () => {
  const { client, fetch } = makeClient(() => ({
    account: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    network: 'testnet',
    data: [
      {
        poolId: POOL.id,
        shares: '50',
        totalShares: '5000',
        shareOfPoolBps: 100,
        reserves: POOL.reserves,
        redeemable: [{ asset: 'native', issuer: null, amount: '10' }],
      },
    ],
  }));
  const positions = await client.liquidity.positions('GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO');
  assert.match(fetch.calls[0].url, /\/liquidity-pools\/positions\?account=GCALN/);
  assert.equal(positions.data[0].shareOfPoolBps, 100);
  assert.equal(positions.data[0].redeemable[0].amount, '10');
});

test('browsing pools pages by CURSOR, because Horizon does', async () => {
  const { client, fetch } = makeClient(() => ({ data: [POOL], cursor: 'next-page' }));
  const page = await client.liquidity.browse({ assetACode: 'XLM', limit: 10 });
  assert.match(fetch.calls[0].url, /assetACode=XLM/);
  assert.match(fetch.calls[0].url, /limit=10/);
  assert.equal(page.items[0].id, POOL.id);
  assert.equal(page.cursor, 'next-page');
});

test('a last page reports no cursor rather than undefined', async () => {
  const { client } = makeClient(() => ({ data: [POOL] }));
  const page = await client.liquidity.browse();
  assert.equal(page.cursor, null);
});

test('one pool is fetched by its hex id', async () => {
  const { client, fetch } = makeClient(() => POOL);
  const pool = await client.liquidity.pool(POOL.id);
  assert.match(fetch.calls[0].url, new RegExp(`/liquidity-pools/${POOL.id}$`));
  assert.equal(pool.feeBp, 30);
  assert.equal(pool.reserves.length, 2);
});

test('operations list is paginated and materialized', async () => {
  const { client, fetch } = makeClient(() => ({
    data: [fakeOperation(), fakeOperation({ id: 'lp_op_2', kind: 'WITHDRAW' })],
    total: 2,
    take: 20,
    skip: 0,
  }));
  const page = await client.liquidity.operations({ kind: 'WITHDRAW', status: 'PENDING', take: 20 });
  assert.match(fetch.calls[0].url, /\/liquidity-pools\/operations\?/);
  assert.match(fetch.calls[0].url, /kind=WITHDRAW/);
  assert.match(fetch.calls[0].url, /status=PENDING/);
  assert.equal(page.total, 2);
  assert.ok(page.items[0] instanceof LiquidityOperation);
});

test('one operation is fetched by id and cached', async () => {
  const { client } = makeClient(() => fakeOperation());
  const op = await client.liquidity.fetch('lp_op_test_123');
  assert.equal(op.id, 'lp_op_test_123');
  assert.equal(client.liquidity.cache.get('lp_op_test_123'), op);
});

// ── Submitting ───────────────────────────────────────────────────────────────

test('submit relays the signed envelope and returns the outcome', async () => {
  const { client, fetch } = makeClient(() => ({
    submitted: true,
    status: 'SUCCEEDED',
    txHash: 'abc123',
    operation: fakeOperation({ status: 'SUCCEEDED', txHash: 'abc123', shares: '42' }),
  }));
  const outcome = await client.liquidity.submit('lp_op_test_123', { signedXdr: 'SIGNED' });
  assert.equal(fetch.calls[0].method, 'POST');
  assert.match(fetch.calls[0].url, /\/liquidity-pools\/operations\/lp_op_test_123\/submit$/);
  assert.equal(fetch.calls[0].body.signedXdr, 'SIGNED');
  assert.equal(outcome.submitted, true);
  assert.equal(outcome.txHash, 'abc123');
  assert.ok(outcome.operation instanceof LiquidityOperation);
  assert.equal(outcome.operation.isSucceeded, true);
  // Absent optional fields come back as null, not undefined: a caller reading
  // `reason` should not have to tell "no reason" from "field missing".
  assert.equal(outcome.reason, null);
  assert.equal(outcome.resultCodes, null);
});

test('submitting from the instance patches the instance in place', async () => {
  // The caller is holding this object. Leaving it showing PENDING after a
  // successful submit is the kind of staleness that gets rendered into a UI.
  const { client } = makeClient((_url, _init, call) =>
    call === 0
      ? fakeOperation()
      : {
          submitted: true,
          status: 'SUCCEEDED',
          txHash: 'abc123',
          operation: fakeOperation({ status: 'SUCCEEDED', txHash: 'abc123' }),
        },
  );
  const op = await client.liquidity.deposit({ source: 'G...', maxAmountA: '1', maxAmountB: '1' });
  assert.equal(op.isPending, true);
  await op.submit({ signedXdr: 'SIGNED' });
  assert.equal(op.isSucceeded, true);
  assert.equal(op.txHash, 'abc123');
});

test('an operation can re-read itself', async () => {
  const { client, fetch } = makeClient((_url, _init, call) =>
    call === 0 ? fakeOperation() : fakeOperation({ status: 'SUBMITTED' }),
  );
  const op = await client.liquidity.fetch('lp_op_test_123');
  await op.fetch();
  assert.equal(op.status, 'SUBMITTED');
  assert.equal(fetch.calls.length, 2);
  assert.match(fetch.calls[1].url, /\/liquidity-pools\/operations\/lp_op_test_123$/);
});

test('toJSON round-trips the payload the API sent', async () => {
  const payload = fakeOperation();
  const { client } = makeClient(() => payload);
  const op = await client.liquidity.fetch(payload.id);
  assert.deepEqual(op.toJSON(), payload);
});
