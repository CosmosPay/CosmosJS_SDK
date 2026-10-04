// KYC/KYB. Offline: an injected `fetch` answers every call.
//
// This is where the SDK is most likely to be used wrong rather than break: the
// KYC flow has an order (terms of service, upload, receiver) that the API will
// not guess for you. The tests below pin the plumbing that makes it expressible.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Client, Receiver } from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'dv_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

function fakeReceiver(overrides = {}) {
  return {
    id: 're_1',
    blindpayId: 'rc_000000000000',
    type: 'individual',
    kycType: 'standard',
    kycStatus: 'pending',
    email: 'a@b.com',
    name: 'Ada Lovelace',
    country: 'BR',
    externalId: null,
    disabled: false,
    dossierVersion: 3,
    reviewedVersion: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── KYC: receivers ───────────────────────────────────────────────────────────

test('a receiver is created and materialized', async () => {
  const { client, fetch } = makeClient(() => fakeReceiver());
  const receiver = await client.kyc.createReceiver({
    type: 'individual',
    kyc_type: 'standard',
    email: 'a@b.com',
    country: 'BR',
    tos_id: 'tos_1',
  });
  assert.ok(receiver instanceof Receiver);
  assert.match(fetch.calls[0].url, /\/v1\/kyc\/receivers$/);
  assert.equal(fetch.calls[0].body.tos_id, 'tos_1');
  assert.equal(receiver.isApproved, false);
  assert.ok(receiver.createdAt instanceof Date);
});

test('approval is a status, not a flag the SDK invents', async () => {
  const { client } = makeClient(() => fakeReceiver({ kycStatus: 'approved' }));
  const receiver = await client.kyc.fetchReceiver('re_1');
  assert.equal(receiver.isApproved, true);
});

test('a receiver re-reads itself, refreshing the KYC status in place', async () => {
  const { client, fetch } = makeClient((_url, _init, call) =>
    call === 0 ? fakeReceiver() : fakeReceiver({ kycStatus: 'approved' }),
  );
  const receiver = await client.kyc.fetchReceiver('re_1');
  assert.equal(receiver.kycStatus, 'pending');
  await receiver.fetch();
  assert.equal(receiver.kycStatus, 'approved');
  assert.equal(fetch.calls.length, 2);
});

test('updating patches the instance rather than returning a second one', async () => {
  const { client, fetch } = makeClient(() => fakeReceiver({ email: 'new@b.com' }));
  const receiver = await client.kyc.createReceiver({
    type: 'individual',
    kyc_type: 'light',
    email: 'a@b.com',
    country: 'BR',
  });
  await receiver.update({ email: 'new@b.com' });
  assert.equal(fetch.calls[1].method, 'PATCH');
  assert.equal(receiver.email, 'new@b.com');
});

test('the access kill switch is a PATCH and lands on the instance', async () => {
  const { client, fetch } = makeClient((url) =>
    url.includes('/access') ? fakeReceiver({ disabled: true }) : fakeReceiver(),
  );
  const receiver = await client.kyc.fetchReceiver('re_1');
  assert.equal(receiver.disabled, false);
  await receiver.setAccess(true);
  assert.equal(fetch.calls[1].method, 'PATCH');
  assert.match(fetch.calls[1].url, /\/kyc\/receivers\/re_1\/access$/);
  assert.equal(fetch.calls[1].body.disabled, true);
  assert.equal(receiver.disabled, true);
});

test('approving pins the version of the dossier that was read', async () => {
  // A review is a person reading the KYC data and then approving it. The tenant can
  // edit in between and the status stays `pending_review`, so the version is the only
  // thing that tells the API which dossier was actually reviewed.
  const { client, fetch } = makeClient(() => fakeReceiver({ kycStatus: 'pending_user' }));
  const receiver = await client.kyc.fetchReceiver('re_1');

  await receiver.approve({ redirect_url: 'https://app.acme.com/kyc/return' });

  assert.match(fetch.calls[1].url, /\/kyc\/receivers\/re_1\/approve$/);
  assert.equal(fetch.calls[1].body.expected_version, 3);
});

test('an explicit expected_version wins, including undefined to opt out', async () => {
  const { client, fetch } = makeClient(() => fakeReceiver());
  const receiver = await client.kyc.fetchReceiver('re_1');

  await receiver.approve({ redirect_url: 'https://app.acme.com/r', expected_version: 1 });
  assert.equal(fetch.calls[1].body.expected_version, 1);

  await receiver.approve({ redirect_url: 'https://app.acme.com/r', expected_version: undefined });
  assert.equal('expected_version' in fetch.calls[2].body, false);
});

test('the manager approves exactly what it is handed, with no id to infer from', async () => {
  const { client, fetch } = makeClient(() => fakeReceiver());

  await client.kyc.approveReceiver('re_9', { redirect_url: 'https://app.acme.com/r' });

  assert.equal('expected_version' in fetch.calls[0].body, false);
});

test('the reviewed version is carried onto the instance', async () => {
  const { client } = makeClient(() => fakeReceiver({ reviewedVersion: 3 }));
  const receiver = await client.kyc.fetchReceiver('re_1');

  assert.equal(receiver.dossierVersion, 3);
  assert.equal(receiver.reviewedVersion, 3);
});

test('deleting a receiver drops it from the cache too', async () => {
  const { client } = makeClient(() => fakeReceiver());
  const receiver = await client.kyc.fetchReceiver('re_1');
  assert.equal(client.kyc.cache.get('re_1'), receiver);
  await receiver.delete();
  assert.equal(client.kyc.cache.has('re_1'), false);
});

test('receivers are listed with pagination', async () => {
  const { client } = makeClient(() => ({
    data: [fakeReceiver(), fakeReceiver({ id: 're_2' })],
    total: 2,
    take: 20,
    skip: 0,
  }));
  const page = await client.kyc.receivers({ take: 20 });
  assert.equal(page.total, 2);
  assert.ok(page.items[1] instanceof Receiver);
});

// ── KYC: the flow around a receiver ──────────────────────────────────────────

test('terms of service comes FIRST and returns the hosted URL', async () => {
  // The provider will not create a receiver without a `tos_id`, so this is step
  // one of the flow rather than a formality at the end.
  const { client, fetch } = makeClient(() => ({ url: 'https://tos.example/abc', id: 'tos_1' }));
  const tos = await client.kyc.termsOfService({ redirect_url: 'https://app/done' });
  assert.match(fetch.calls[0].url, /\/kyc\/terms-of-service$/);
  assert.equal(tos.url, 'https://tos.example/abc');
  assert.equal(tos.id, 'tos_1');
});

test('documents are uploaded first and referenced by URL', async () => {
  const { client, fetch } = makeClient(() => ({ file_url: 'https://files/x.png' }));
  const uploaded = await client.kyc.upload({ file: 'base64…' });
  assert.match(fetch.calls[0].url, /\/kyc\/upload$/);
  assert.equal(uploaded.file_url, 'https://files/x.png');
});

test('wallets are proved, not just claimed', async () => {
  // The sign-message challenge is what turns "this address is mine" into evidence.
  const { client, fetch } = makeClient((url) =>
    url.includes('sign-message')
      ? { message: 'prove you own this' }
      : { id: 'w_1', blindpayId: 'bw_1', name: null, network: 'stellar', address: 'G…', isAccountAbstraction: false, createdAt: '2026-01-01T00:00:00.000Z' },
  );
  const challenge = await client.kyc.walletSignMessage('re_1');
  assert.match(fetch.calls[0].url, /\/kyc\/receivers\/re_1\/wallets\/sign-message$/);
  assert.equal(challenge.message, 'prove you own this');

  const wallet = await client.kyc.addWallet('re_1', {
    network: 'stellar',
    address: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    signature_tx_hash: 'abc123',
  });
  assert.equal(fetch.calls[1].body.signature_tx_hash, 'abc123');
  assert.equal(wallet.network, 'stellar');
});

test('a bank account carries rail-specific fields the type does not enumerate', async () => {
  // ~70 of them, and which ones a rail needs comes from `bankDetails(rail)` at
  // runtime. Freezing that list into a published type breaks the day a rail is
  // added, so the extra fields pass through instead.
  const { client, fetch } = makeClient(() => ({
    id: 'ba_1',
    blindpayId: 'bb_1',
    rail: 'pix',
    name: 'Ada',
    country: 'BR',
    createdAt: '2026-01-01T00:00:00.000Z',
  }));
  await client.kyc.addBankAccount('re_1', {
    type: 'pix',
    name: 'Ada',
    pix_key: 'ada@example.com',
  });
  assert.match(fetch.calls[0].url, /\/kyc\/receivers\/re_1\/bank-accounts$/);
  assert.equal(fetch.calls[0].body.pix_key, 'ada@example.com');
});

test('the rail field schema is asked for by name', async () => {
  const { client, fetch } = makeClient(() => ({ fields: ['pix_key'] }));
  await client.kyc.bankDetails('pix');
  assert.match(fetch.calls[0].url, /\/kyc\/bank-details\?rail=pix$/);
});

test('a receiver reaches its own wallets and bank accounts', async () => {
  const { client, fetch } = makeClient((url) => {
    if (url.includes('/wallets')) return { data: [], total: 0, take: 20, skip: 0 };
    if (url.includes('/bank-accounts')) return { data: [], total: 0, take: 20, skip: 0 };
    return fakeReceiver();
  });
  const receiver = await client.kyc.fetchReceiver('re_1');
  await receiver.wallets();
  await receiver.bankAccounts();
  assert.match(fetch.calls[1].url, /\/receivers\/re_1\/wallets/);
  assert.match(fetch.calls[2].url, /\/receivers\/re_1\/bank-accounts/);
});
