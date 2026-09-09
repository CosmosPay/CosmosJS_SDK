// On-ramp, off-ramp and the activity stream. Offline: an injected `fetch` answers
// every call, so what is asserted is the request this SDK makes and the shape it
// returns — the two things a consumer actually depends on.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

const PAYIN = {
  id: 'payin_1',
  blindpayId: 'pi_000000000000',
  status: 'processing',
  token: 'USDC',
  network: 'stellar',
  paymentMethod: 'pix',
  senderAmount: '10000',
  receiverAmount: '9950',
  instructions: { pix_code: '00020126...' },
  createdAt: '2026-01-01T00:00:00.000Z',
};

const PAYOUT = {
  id: 'payout_1',
  blindpayId: 'po_000000000000',
  status: 'processing',
  token: 'USDC',
  network: 'stellar',
  rail: 'pix',
  senderAmount: '5000',
  receiverAmount: '4900',
  senderWalletAddress: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// ── On-ramp ──────────────────────────────────────────────────────────────────

test('a payin quote is posted with the provider field names, unchanged', async () => {
  // snake_case is the RAMP PROVIDER's vocabulary and the service passes it through.
  // A camelCase surface here would be a translation layer between two systems that
  // already agree, and one more place for a field name to be wrong.
  const { client, fetch } = makeClient(() => ({ id: 'q_1', expires_at: 1893456000, sender_amount: 10000 }));
  const quote = await client.onramp.quote({
    blockchain_wallet_id: 'w_123',
    currency_type: 'sender',
    payment_method: 'pix',
    token: 'USDC',
    request_amount: 10000,
  });
  assert.match(fetch.calls[0].url, /\/v1\/onramp\/quotes$/);
  assert.equal(fetch.calls[0].method, 'POST');
  assert.equal(fetch.calls[0].body.payment_method, 'pix');
  assert.equal(fetch.calls[0].body.request_amount, 10000);
  assert.equal(quote.id, 'q_1');
  assert.equal(typeof quote.expires_at, 'number');
});

test('a payin is created FROM a quote and returns the funding instructions', async () => {
  const { client, fetch } = makeClient(() => PAYIN);
  const payin = await client.onramp.createPayin({ payin_quote_id: 'q_1' });
  assert.match(fetch.calls[0].url, /\/onramp\/payins$/);
  assert.equal(fetch.calls[0].body.payin_quote_id, 'q_1');
  // The instructions are the payer's half of the deal — pass them through as they
  // came, because their shape depends on the rail.
  assert.deepEqual(payin.instructions, { pix_code: '00020126...' });
});

test('payins are listed with pagination and read back one by one', async () => {
  const { client, fetch } = makeClient((url) =>
    url.includes('payin_1') ? PAYIN : { data: [PAYIN], total: 1, take: 20, skip: 0 },
  );
  const page = await client.onramp.payins({ take: 20, skip: 0 });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, 'payin_1');

  const one = await client.onramp.payin('payin_1');
  assert.match(fetch.calls[1].url, /\/onramp\/payins\/payin_1$/);
  assert.equal(one.status, 'processing');
});

test('the trustline endpoint returns the unsigned envelope to sign', async () => {
  const { client, fetch } = makeClient(() => ({ xdr: 'AAAAAgAAAAB', issuer: 'GA5Z…' }));
  const result = await client.onramp.createTrustline({ address: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO' });
  assert.match(fetch.calls[0].url, /\/onramp\/trustline$/);
  assert.equal(result.xdr, 'AAAAAgAAAAB');
  // Open shape on purpose: it is a provider passthrough, and dropping the fields
  // this SDK does not know about would hide the issuer the payout will use.
  assert.equal(result.issuer, 'GA5Z…');
});

test('a virtual account is opened against a receiver', async () => {
  const { client, fetch } = makeClient(() => ({ id: 'va_1' }));
  await client.onramp.createVirtualAccount('re_1', {
    banking_partner: 'cfsb',
    token: 'USDC',
    blockchain_wallet_id: 'w_123',
  });
  assert.match(fetch.calls[0].url, /\/onramp\/receivers\/re_1\/virtual-accounts$/);
  assert.equal(fetch.calls[0].body.banking_partner, 'cfsb');
});

// ── Off-ramp ─────────────────────────────────────────────────────────────────

test('a payout quote carries the EVM contract when there is one', async () => {
  const { client, fetch } = makeClient(() => ({
    id: 'pq_1',
    expires_at: 1893456000,
    sender_amount: 5000,
    receiver_local_amount: 24500,
    contract: { functionName: 'approve' },
  }));
  const quote = await client.offramp.quote({
    bank_account_id: 'ba_1',
    currency_type: 'sender',
    request_amount: 5000,
    network: 'stellar',
    token: 'USDC',
  });
  assert.match(fetch.calls[0].url, /\/v1\/offramp\/quotes$/);
  assert.equal(quote.receiver_local_amount, 24500);
  assert.deepEqual(quote.contract, { functionName: 'approve' });
});

test('authorize builds the transfer, and creating the payout carries its signature', async () => {
  // The middle step is the one people skip. A payout created without the signed
  // transfer is a payout with nothing behind it.
  const { client, fetch } = makeClient((url) =>
    url.includes('authorize') ? { xdr: 'UNSIGNED' } : PAYOUT,
  );
  const authorized = await client.offramp.authorize({
    quote_id: 'pq_1',
    sender_wallet_address: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    chain: 'stellar',
  });
  assert.match(fetch.calls[0].url, /\/offramp\/payouts\/authorize$/);
  assert.equal(authorized.xdr, 'UNSIGNED');

  const payout = await client.offramp.createPayout({
    quote_id: 'pq_1',
    sender_wallet_address: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    chain: 'stellar',
    signed_transaction: 'SIGNED',
  });
  assert.match(fetch.calls[1].url, /\/offramp\/payouts$/);
  assert.equal(fetch.calls[1].body.signed_transaction, 'SIGNED');
  assert.equal(payout.rail, 'pix');
});

test('payouts are listed and read back, and documents attach to one', async () => {
  const { client, fetch } = makeClient((url) => {
    if (url.includes('/documents')) return { id: 'doc_1' };
    if (url.match(/payouts\/payout_1$/)) return PAYOUT;
    return { data: [PAYOUT], total: 1, take: 20, skip: 0 };
  });
  const page = await client.offramp.payouts();
  assert.equal(page.items[0].id, 'payout_1');
  await client.offramp.payout('payout_1');
  await client.offramp.attachDocument('payout_1', { description: 'invoice' });
  assert.match(fetch.calls[2].url, /\/offramp\/payouts\/payout_1\/documents$/);
  assert.equal(fetch.calls[2].body.description, 'invoice');
});

// ── Activity ─────────────────────────────────────────────────────────────────

test('events report as a batch, from an array or a full body', async () => {
  const { client, fetch } = makeClient(() => ({ accepted: 2, duplicates: 0 }));
  const result = await client.activity.report([
    { type: 'checkout.opened', eventId: 'e1' },
    { type: 'checkout.paid', eventId: 'e2' },
  ]);
  assert.match(fetch.calls[0].url, /\/v1\/activity\/events$/);
  assert.equal(fetch.calls[0].body.events.length, 2);
  assert.equal(result.accepted, 2);

  await client.activity.report({ events: [{ type: 'x' }] });
  assert.equal(fetch.calls[1].body.events.length, 1);
});

test('a duplicate batch is reported as duplicates, not as failure', async () => {
  // De-duplication on `eventId` is what makes a retry safe. A consumer needs to see
  // that the second delivery landed and was recognised, not an error.
  const { client } = makeClient(() => ({ accepted: 0, duplicates: 2 }));
  const result = await client.activity.report([{ type: 'a', eventId: 'e1' }]);
  assert.equal(result.accepted, 0);
  assert.equal(result.duplicates, 2);
});

test('events are filtered by every dimension the service supports', async () => {
  const { client, fetch } = makeClient(() => ({ data: [], total: 0, take: 20, skip: 0 }));
  await client.activity.events({
    source: 'wallet',
    level: 'error',
    category: 'tx',
    type: 'send.failed',
    network: 'testnet',
    since: '2026-01-01T00:00:00.000Z',
    take: 20,
  });
  const url = fetch.calls[0].url;
  for (const part of ['source=wallet', 'level=error', 'category=tx', 'type=send.failed', 'network=testnet', 'take=20']) {
    assert.match(url, new RegExp(part.replace('.', '\\.')));
  }
  assert.match(url, /since=2026-01-01/);
});

test('the summary comes back with its buckets and series', async () => {
  const { client, fetch } = makeClient(() => ({
    total: 10,
    sessions: 3,
    devices: 2,
    levels: [{ key: 'error', count: 4 }],
    sources: [{ key: 'wallet', count: 10 }],
    categories: [],
    topTypes: [{ key: 'send.failed', count: 4 }],
    topErrors: [{ key: 'tx_failed', count: 4 }],
    series: [{ date: '2026-01-01', count: 10, errors: 4 }],
  }));
  const summary = await client.activity.summary({ days: 30, source: 'wallet' });
  assert.match(fetch.calls[0].url, /\/activity\/summary\?days=30&source=wallet$/);
  assert.equal(summary.total, 10);
  assert.equal(summary.series[0].errors, 4);
});
