// USDT0 from Stellar to EVM networks (`client.usdt0`). Offline: an injected
// `fetch` answers every call.
//
// Signing works like a swap: the API builds the transaction, the holder signs it,
// and `submit` relays the signed XDR.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, Usdt0Transfer, Usdt0TransferStatus } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'prod_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

const HOLDER = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ';
const EVM = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';

function fakeTransfer(overrides = {}) {
  return {
    id: 'u0_1',
    status: 'PENDING',
    network: 'public',
    source: HOLDER,
    to: 'arb',
    eid: 30110,
    receives: 'USDT0',
    recipient: EVM,
    amount: '12.5000001',
    amountSent: '12.5',
    amountReceived: '12.5',
    dust: '0.0000001',
    nativeFee: '3.6664143',
    nativeFeeLimit: '4.3996972',
    networkFee: '1.4468825',
    feeBps: 0,
    feeAmount: '0',
    feeWallet: null,
    xdr: 'AAAA',
    uri: 'web+stellar:tx?xdr=AAAA',
    qr: null,
    txHash: null,
    guid: null,
    destinationTxHash: null,
    scanStatus: null,
    scanUrl: null,
    failureReason: null,
    merchantFee: null,
    idempotencyKey: null,
    expiresAt: '2026-10-25T12:05:00.000Z',
    submittedAt: null,
    createdAt: '2026-10-25T12:00:00.000Z',
    updatedAt: '2026-10-25T12:00:00.000Z',
    ...overrides,
  };
}

test('the client wires client.usdt0', () => {
  const { client } = makeClient(() => ({}));
  assert.ok(client.usdt0);
});

test('routes GETs /usdt0/routes and returns it as is', async () => {
  const routes = {
    network: 'public',
    available: true,
    token: { code: 'USDT0', issuer: 'GATISXX6', contract: 'CBSJZEIO' },
    oft: 'CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6',
    eid: 30600,
    routes: [{ chain: 'eth', name: 'Ethereum', eid: 30101, receives: 'USDT' }],
  };
  const { client, fetch } = makeClient(() => routes);

  const result = await client.usdt0.routes();

  assert.equal(fetch.calls[0].method, 'GET');
  assert.match(fetch.calls[0].url, /\/v1\/usdt0\/routes$/);
  assert.deepEqual(result, routes);
});

test('quote POSTs to /usdt0/quote and returns a plain object', async () => {
  const { client, fetch } = makeClient(() => ({
    to: 'eth',
    eid: 30101,
    receives: 'USDT',
    amount: '12.5',
    feeBps: 0,
    feeAmount: '0',
    amountSent: '12.5',
    amountReceived: '12.5',
    dust: '0',
    nativeFee: '3.6664143',
    nativeFeeLimit: '4.3996972',
    minAmount: '0',
    maxAmount: '1844674407370.9551615',
  }));

  const quote = await client.usdt0.quote({ to: 'eth', amount: '12.5', source: HOLDER });

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/usdt0\/quote$/);
  assert.deepEqual(call.body, { to: 'eth', amount: '12.5', source: HOLDER });
  assert.ok(!(quote instanceof Usdt0Transfer));
  assert.equal(quote.receives, 'USDT');
});

test('create POSTs to /usdt0/transfers and yields a Usdt0Transfer to sign', async () => {
  const { client, fetch } = makeClient(() => fakeTransfer());

  const transfer = await client.usdt0.create({
    source: HOLDER,
    to: 'arb',
    recipient: EVM,
    amount: '12.5000001',
    merchantFee: { fixed: '0.25', wallet: HOLDER },
  });

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/usdt0\/transfers$/);
  assert.deepEqual(call.body, {
    source: HOLDER,
    to: 'arb',
    recipient: EVM,
    amount: '12.5000001',
    merchantFee: { fixed: '0.25', wallet: HOLDER },
  });
  assert.equal(call.headers['Idempotency-Key'], undefined);
  assert.ok(transfer instanceof Usdt0Transfer);
  assert.equal(transfer.xdr, 'AAAA');
  assert.equal(transfer.isPending, true);
  assert.equal(transfer.isFinal, false);
  assert.ok(transfer.expiresAt instanceof Date);
  assert.equal(client.usdt0.cache.get('u0_1'), transfer);
});

test('an idempotency key travels as the header and in the body', async () => {
  const { client, fetch } = makeClient(() => fakeTransfer({ idempotencyKey: 'k-1' }));

  await client.usdt0.create({
    source: HOLDER,
    to: 'eth',
    recipient: EVM,
    amount: '1',
    idempotencyKey: 'k-1',
  });

  assert.equal(fetch.calls[0].headers['Idempotency-Key'], 'k-1');
  assert.equal(fetch.calls[0].body.idempotencyKey, 'k-1');
});

test('list GETs /usdt0/transfers with status, take and skip in the query', async () => {
  const { qr, ...row } = fakeTransfer({ status: 'DELIVERED' });
  const { client, fetch } = makeClient(() => ({ data: [row], total: 1, take: 5, skip: 10 }));

  const page = await client.usdt0.list({ status: Usdt0TransferStatus.Delivered, take: 5, skip: 10 });

  const call = fetch.calls[0];
  assert.equal(call.method, 'GET');
  const url = new URL(call.url);
  assert.equal(url.pathname, '/v1/usdt0/transfers');
  assert.equal(url.searchParams.get('status'), 'DELIVERED');
  assert.equal(url.searchParams.get('take'), '5');
  assert.equal(url.searchParams.get('skip'), '10');
  assert.equal(page.total, 1);
  assert.ok(page.items[0] instanceof Usdt0Transfer);
  assert.equal(page.items[0].isDelivered, true);
  assert.equal(page.items[0].isFinal, true);
  assert.equal(page.items[0].qr, null);
});

test('fetch GETs /usdt0/transfers/:id, with X-Record-Token only when given', async () => {
  const { client, fetch } = makeClient(() => fakeTransfer());

  await client.usdt0.fetch('u0_1');
  await client.usdt0.fetch('u0_1', { recordToken: 'tok' });

  assert.equal(fetch.calls[0].method, 'GET');
  assert.match(fetch.calls[0].url, /\/v1\/usdt0\/transfers\/u0_1$/);
  assert.equal(fetch.calls[0].headers['X-Record-Token'], undefined);
  assert.equal(fetch.calls[1].headers['X-Record-Token'], 'tok');
});

test('submit POSTs only the signed XDR and materializes the transfer', async () => {
  const { client, fetch } = makeClient(() => ({
    submitted: true,
    status: 'SUBMITTED',
    txHash: 'ab'.repeat(32),
    reason: null,
    transfer: fakeTransfer({ status: 'SUBMITTED', txHash: 'ab'.repeat(32), guid: '0x01' }),
  }));

  const outcome = await client.usdt0.submit('u0_1', { signedXdr: 'SIGNED', recordToken: 'tok' });

  const call = fetch.calls[0];
  assert.equal(call.method, 'POST');
  assert.match(call.url, /\/v1\/usdt0\/transfers\/u0_1\/submit$/);
  assert.deepEqual(call.body, { signedXdr: 'SIGNED' });
  assert.equal(call.headers['X-Record-Token'], 'tok');
  assert.equal(outcome.submitted, true);
  assert.equal(outcome.status, 'SUBMITTED');
  assert.equal(outcome.txHash, 'ab'.repeat(32));
  assert.equal(outcome.reason, null);
  assert.ok(outcome.transfer instanceof Usdt0Transfer);
  assert.equal(outcome.transfer.guid, '0x01');
});

test('a refused submit leaves it pending with the reason', async () => {
  const { client } = makeClient(() => ({
    submitted: false,
    status: 'PENDING',
    reason: 'tx_insufficient_fee',
    transfer: fakeTransfer(),
  }));

  const outcome = await client.usdt0.submit('u0_1', { signedXdr: 'SIGNED' });

  assert.equal(outcome.submitted, false);
  assert.equal(outcome.txHash, null);
  assert.equal(outcome.reason, 'tx_insufficient_fee');
  assert.equal(outcome.transfer.isPending, true);
});

test('a Usdt0Transfer submits, follows itself, and keeps its record token throughout', async () => {
  const { client, fetch } = makeClient((url, init) => {
    if (url.endsWith('/submit')) {
      return {
        submitted: true,
        status: 'SUBMITTED',
        txHash: 'ab'.repeat(32),
        transfer: fakeTransfer({ status: 'SUBMITTED', txHash: 'ab'.repeat(32) }),
      };
    }
    if (init.method === 'POST') return fakeTransfer({ publicToken: 'tok' });
    return fakeTransfer({
      status: 'DELIVERED',
      txHash: 'ab'.repeat(32),
      destinationTxHash: '0xdead',
      submittedAt: '2026-10-25T12:01:00.000Z',
    });
  });

  const transfer = await client.usdt0.create({ source: HOLDER, to: 'arb', recipient: EVM, amount: '12.5' });
  assert.equal(transfer.publicToken, 'tok');

  const outcome = await transfer.submit({ signedXdr: 'SIGNED' });
  assert.deepEqual(fetch.calls[1].body, { signedXdr: 'SIGNED' });
  assert.equal(fetch.calls[1].headers['X-Record-Token'], 'tok');
  assert.equal(outcome.status, 'SUBMITTED');
  assert.equal(transfer.status, 'SUBMITTED');
  assert.equal(transfer.publicToken, 'tok');

  const same = await transfer.fetch();
  assert.equal(same, transfer);
  assert.equal(fetch.calls[2].method, 'GET');
  assert.match(fetch.calls[2].url, /\/v1\/usdt0\/transfers\/u0_1$/);
  assert.equal(fetch.calls[2].headers['X-Record-Token'], 'tok');
  assert.equal(transfer.isDelivered, true);
  assert.equal(transfer.destinationTxHash, '0xdead');
  assert.ok(transfer.submittedAt instanceof Date);
  assert.equal(transfer.publicToken, 'tok');
});

test('toJSON round-trips the raw payload', () => {
  const { client } = makeClient(() => ({}));
  const raw = fakeTransfer({
    status: 'DELIVERED',
    submittedAt: '2026-10-25T12:01:00.000Z',
    merchantFee: { bps: 0, fixed: '0.25', amount: '0.25', asset: 'USDT0', wallet: HOLDER, paidBy: 'recipient' },
  });
  assert.deepEqual(new Usdt0Transfer(client, raw).toJSON(), raw);
});
