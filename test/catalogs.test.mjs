// Typed catalogs — assets / wallets / addresses. Fully offline.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  Client,
  Assets,
  TestnetAssets,
  defineAsset,
  resolveAsset,
  isNativeAsset,
  Wallets,
  AddressBook,
  addresses,
  resolveAddress,
  isStellarAddress,
  resolveIntentBody,
} from '../dist/index.js';
import { mockFetch, fakeIntent } from './helpers.mjs';

const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const G_ACCOUNT = 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';

// ── Assets ───────────────────────────────────────────────────────────────────

test('built-in assets carry verified issuers', () => {
  assert.equal(Assets.USDC.issuer, USDC_ISSUER);
  assert.equal(Assets.USDC.code, 'USDC');
  assert.equal(Assets.XLM.issuer, null);
  assert.equal(TestnetAssets.USDC.issuer, 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5');
});

test('resolveAsset expands a catalog asset to code + issuer', () => {
  assert.deepEqual(resolveAsset(Assets.USDC), { code: 'USDC', issuer: USDC_ISSUER });
});

test('resolveAsset treats a bare string as code-only (backwards compatible)', () => {
  assert.deepEqual(resolveAsset('USDC'), { code: 'USDC', issuer: null });
});

test('resolveAsset normalizes native variants', () => {
  for (const ref of ['XLM', 'native', '', Assets.XLM]) {
    assert.deepEqual(resolveAsset(ref), { code: 'XLM', issuer: null });
  }
  assert.equal(isNativeAsset('xlm'), true);
  assert.equal(isNativeAsset(Assets.USDC), false);
});

test('defineAsset validates and freezes', () => {
  const aqua = defineAsset({ code: 'AQUA', issuer: G_ACCOUNT, name: 'Aquarius' });
  assert.equal(aqua.code, 'AQUA');
  assert.deepEqual(resolveAsset(aqua), { code: 'AQUA', issuer: G_ACCOUNT });
  assert.throws(() => defineAsset({ code: 'BAD', issuer: 'not-an-address' }), /invalid issuer/);
});

// ── Addresses ──────────────────────────────────────────────────────────────────

test('isStellarAddress recognizes G-addresses', () => {
  assert.equal(isStellarAddress(G_ACCOUNT), true);
  assert.equal(isStellarAddress('nope'), false);
});

test('AddressBook resolves names and passes unknown strings through', () => {
  const book = new AddressBook();
  book.define('merchant', G_ACCOUNT);
  assert.equal(book.resolve('merchant'), G_ACCOUNT);
  assert.equal(book.resolve(G_ACCOUNT), G_ACCOUNT);
  assert.equal(book.resolve('user*domain.com'), 'user*domain.com'); // federation passthrough
  assert.throws(() => book.define('bad', 'xxx'), /Invalid Stellar/);
});

// ── Wallets ────────────────────────────────────────────────────────────────────

test('Wallets exposes typed ids', () => {
  assert.equal(Wallets.FREIGHTER, 'freighter');
  assert.equal(Wallets.XBULL, 'xbull');
});

// ── resolveIntentBody ──────────────────────────────────────────────────────────

test('resolveIntentBody expands a typed asset', () => {
  const body = resolveIntentBody({ destination: G_ACCOUNT, amount: '10', asset: Assets.USDC });
  assert.equal(body.assetCode, 'USDC');
  assert.equal(body.assetIssuer, USDC_ISSUER);
  assert.equal('asset' in body, false);
});

test('resolveIntentBody leaves native assets unset', () => {
  const body = resolveIntentBody({ destination: G_ACCOUNT, amount: '1', asset: Assets.XLM });
  assert.equal(body.assetCode, undefined);
  assert.equal(body.assetIssuer, undefined);
});

test('resolveIntentBody: explicit code/issuer win over asset', () => {
  const body = resolveIntentBody({
    destination: G_ACCOUNT,
    asset: Assets.USDC,
    assetCode: 'CUSTOM',
    assetIssuer: G_ACCOUNT,
  });
  assert.equal(body.assetCode, 'CUSTOM');
  assert.equal(body.assetIssuer, G_ACCOUNT);
});

// ── Server Client integration ───────────────────────────────────────────────────

test('Client.createPay sends the resolved asset to the API', async () => {
  const fetch = mockFetch(() => fakeIntent());
  const client = new Client({ apiKey: 'dv_test', fetch });
  await client.paymentIntents.createPay({
    destination: G_ACCOUNT,
    amount: '10',
    asset: Assets.USDC,
  });
  const sent = fetch.calls[0].body;
  assert.equal(sent.assetCode, 'USDC');
  assert.equal(sent.assetIssuer, USDC_ISSUER);
  assert.equal('asset' in sent, false);
});

test('Client.createPay resolves a named destination from the address book', async () => {
  addresses.define('merchant-main', G_ACCOUNT);
  const fetch = mockFetch(() => fakeIntent());
  const client = new Client({ apiKey: 'dv_test', fetch });
  await client.paymentIntents.createPay({ destination: 'merchant-main', amount: '5' });
  assert.equal(fetch.calls[0].body.destination, G_ACCOUNT);
  addresses.delete('merchant-main');
});
