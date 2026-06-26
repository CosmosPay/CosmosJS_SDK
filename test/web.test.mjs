// Web client tests — fully offline. A fake Stellar SDK, mock wallet adapters
// and an injected `fetch` stand in for the browser environment, so no wallet
// extension, Horizon node or network is touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WebClient,
  WalletRegistry,
  parseSep7,
  isSep7Uri,
  normalizeIntent,
  resolveNetwork,
  classifyNetwork,
  PASSPHRASES,
  WalletNotFoundError,
  IntentError,
} from '../dist/web/index.js';
import { mockFetch, fakeIntent } from './helpers.mjs';

// ── Fakes ────────────────────────────────────────────────────────────────────

/** A minimal but structurally-correct stand-in for @stellar/stellar-sdk. */
function fakeStellarSdk() {
  return {
    BASE_FEE: '100',
    Networks: { PUBLIC: PASSPHRASES.public, TESTNET: PASSPHRASES.testnet },
    Asset: class Asset {
      constructor(code, issuer) {
        this.code = code;
        this.issuer = issuer;
      }
      static native() {
        return new Asset('XLM');
      }
    },
    Memo: {
      id: (v) => ({ type: 'id', value: v }),
      text: (v) => ({ type: 'text', value: v }),
      hash: (v) => ({ type: 'hash', value: v }),
      return: (v) => ({ type: 'return', value: v }),
      none: () => ({ type: 'none' }),
    },
    Operation: { payment: (o) => ({ op: 'payment', ...o }) },
    TransactionBuilder: class TransactionBuilder {
      constructor(account, opts) {
        this.account = account;
        this.opts = opts;
        this.ops = [];
      }
      addOperation(op) {
        this.ops.push(op);
        return this;
      }
      addMemo(m) {
        this.memo = m;
        return this;
      }
      setTimeout(t) {
        this.timeoutSeconds = t;
        return this;
      }
      build() {
        const self = this;
        return {
          ops: self.ops,
          memo: self.memo,
          opts: self.opts,
          toXDR: () => 'UNSIGNED_XDR',
        };
      }
      static fromXDR(xdr, passphrase) {
        return { xdr, passphrase, hash: () => 'deadbeef' };
      }
    },
    Horizon: {
      Server: class Server {
        constructor(url) {
          this.url = url;
        }
        async loadAccount(id) {
          return { accountId: () => id, sequenceNumber: () => '1' };
        }
        async fetchBaseFee() {
          return 100;
        }
        async submitTransaction(tx) {
          return { hash: 'horizon_hash_abc', successful: true, _tx: tx };
        }
      },
    },
  };
}

/** A configurable mock wallet adapter. */
function mockWallet(opts = {}) {
  return {
    id: opts.id ?? 'mock',
    name: opts.name ?? 'Mock Wallet',
    _available: opts.available ?? true,
    _pub: opts.pub ?? 'GMOCKACCOUNT0000000000000000000000000000000000000000000',
    calls: [],
    async isAvailable() {
      return this._available;
    },
    async getPublicKey() {
      this.calls.push(['getPublicKey']);
      return this._pub;
    },
    async signTransaction(xdr, params) {
      this.calls.push(['signTransaction', xdr, params]);
      return `SIGNED(${xdr})`;
    },
  };
}

// ── SEP-7 parsing & normalization ─────────────────────────────────────────────

test('isSep7Uri detects web+stellar URIs', () => {
  assert.equal(isSep7Uri('web+stellar:pay?destination=G...'), true);
  assert.equal(isSep7Uri('https://example.com'), false);
  assert.equal(isSep7Uri(42), false);
});

test('parseSep7 parses a pay URI', () => {
  const req = parseSep7(
    'web+stellar:pay?destination=GDEST&amount=10&asset_code=USDC&asset_issuer=GISSUER&memo=42&memo_type=MEMO_ID&callback=url:https://cb.test/submit',
  );
  assert.equal(req.operation, 'pay');
  assert.equal(req.destination, 'GDEST');
  assert.equal(req.amount, '10');
  assert.equal(req.assetCode, 'USDC');
  assert.equal(req.assetIssuer, 'GISSUER');
  assert.equal(req.memo, '42');
  assert.equal(req.callback, 'url:https://cb.test/submit');
});

test('parseSep7 rejects unknown operations', () => {
  assert.throws(() => parseSep7('web+stellar:frobnicate?x=1'), IntentError);
});

test('normalizeIntent accepts a PaymentIntentData', () => {
  const intent = normalizeIntent(fakeIntent({ kind: 'PAY', amount: '12.5' }));
  assert.equal(intent.kind, 'pay');
  assert.equal(intent.destination.startsWith('G'), true);
  assert.equal(intent.amount, '12.5');
  assert.equal(intent.asset, 'native');
});

test('normalizeIntent backfills callback from the embedded SEP-7 URI', () => {
  const intent = normalizeIntent(
    fakeIntent({
      callback: null,
      uri: 'web+stellar:pay?destination=GDEST&callback=url:https://cb.test/x',
    }),
  );
  assert.equal(intent.callback, 'url:https://cb.test/x');
});

test('normalizeIntent accepts a raw SEP-7 URI string', () => {
  const intent = normalizeIntent('web+stellar:pay?destination=GDEST&amount=5');
  assert.equal(intent.kind, 'pay');
  assert.equal(intent.destination, 'GDEST');
  assert.equal(intent.amount, '5');
});

// ── Network resolution ─────────────────────────────────────────────────────────

test('classifyNetwork maps hints to public/testnet', () => {
  assert.equal(classifyNetwork('PUBLIC'), 'public');
  assert.equal(classifyNetwork('testnet'), 'testnet');
  assert.equal(classifyNetwork(PASSPHRASES.testnet), 'testnet');
  assert.equal(classifyNetwork(null), 'public');
});

test('resolveNetwork fills passphrase + horizon from a hint', () => {
  const net = resolveNetwork({ hint: 'testnet' });
  assert.equal(net.network, 'testnet');
  assert.equal(net.passphrase, PASSPHRASES.testnet);
  assert.match(net.horizonUrl, /horizon-testnet/);
});

// ── Wallet registry / auto-detection ───────────────────────────────────────────

test('WalletRegistry.detect picks the first available wallet', async () => {
  const a = mockWallet({ id: 'a', available: false });
  const b = mockWallet({ id: 'b', available: true });
  const registry = new WalletRegistry([a, b]);
  const detected = await registry.detect();
  assert.equal(detected.id, 'b');

  const list = await registry.list();
  assert.deepEqual(
    list.map((w) => [w.id, w.available]),
    [
      ['a', false],
      ['b', true],
    ],
  );
});

test('WalletRegistry.detect honors a preferred id', async () => {
  const a = mockWallet({ id: 'a', available: true });
  const b = mockWallet({ id: 'b', available: true });
  const registry = new WalletRegistry([a, b]);
  assert.equal((await registry.detect('b')).id, 'b');
});

test('WalletRegistry.detect throws when nothing is available', async () => {
  const registry = new WalletRegistry([mockWallet({ available: false })]);
  await assert.rejects(() => registry.detect(), WalletNotFoundError);
});

// ── WebClient.pay ──────────────────────────────────────────────────────────────

test('pay() builds, signs and submits a PAY intent', async () => {
  const wallet = mockWallet({ pub: 'GPAYER000000000000000000000000000000000000000000000000' });
  const client = new WebClient({
    wallets: [wallet],
    stellarSdk: fakeStellarSdk(),
    network: 'testnet',
  });

  const intent = fakeIntent({
    kind: 'PAY',
    source: null,
    amount: '10',
    asset: 'native',
    callback: null,
  });
  const result = await client.pay(intent);

  assert.equal(result.wallet, 'mock');
  assert.equal(result.account, 'GPAYER000000000000000000000000000000000000000000000000');
  assert.equal(result.network, 'testnet');
  assert.equal(result.submitted, true);
  assert.equal(result.txHash, 'horizon_hash_abc');
  // The wallet was asked to sign the freshly-built XDR.
  const signCall = wallet.calls.find((c) => c[0] === 'signTransaction');
  assert.equal(signCall[1], 'UNSIGNED_XDR');
  assert.equal(signCall[2].networkPassphrase, PASSPHRASES.testnet);
  assert.equal(result.signedXdr, 'SIGNED(UNSIGNED_XDR)');
});

test('pay() signs the provided XDR for a TX intent (no rebuild)', async () => {
  const wallet = mockWallet({ pub: 'GSIGNER00000000000000000000000000000000000000000000000' });
  const client = new WebClient({ wallets: [wallet], stellarSdk: fakeStellarSdk() });

  const intent = fakeIntent({
    kind: 'TX',
    source: 'GSIGNER00000000000000000000000000000000000000000000000',
    xdr: 'PREBUILT_TX_XDR',
  });
  const result = await client.pay(intent, { submit: false });

  assert.equal(result.submitted, false);
  assert.equal(result.signedXdr, 'SIGNED(PREBUILT_TX_XDR)');
  // txHash comes from the fake SDK's hash() since nothing was submitted.
  assert.equal(result.txHash, 'deadbeef');
  const signCall = wallet.calls.find((c) => c[0] === 'signTransaction');
  assert.equal(signCall[1], 'PREBUILT_TX_XDR');
});

test('pay() rejects a TX intent when the connected account differs', async () => {
  const wallet = mockWallet({ pub: 'GWRONG000000000000000000000000000000000000000000000000' });
  const client = new WebClient({ wallets: [wallet], stellarSdk: fakeStellarSdk() });
  const intent = fakeIntent({
    kind: 'TX',
    source: 'GEXPECTED0000000000000000000000000000000000000000000000',
    xdr: 'X',
  });
  await assert.rejects(() => client.pay(intent), IntentError);
});

test('pay() POSTs to a SEP-7 callback instead of Horizon', async () => {
  const fetch = mockFetch(() => ({ hash: 'callback_hash_xyz' }));
  const wallet = mockWallet();
  const client = new WebClient({
    wallets: [wallet],
    stellarSdk: fakeStellarSdk(),
    fetch,
  });

  const intent = fakeIntent({
    kind: 'PAY',
    amount: '3',
    callback: 'url:https://cb.test/submit',
  });
  const result = await client.pay(intent);

  assert.equal(result.submitted, true);
  assert.equal(result.txHash, 'callback_hash_xyz');
  assert.equal(fetch.calls.length, 1);
  assert.equal(fetch.calls[0].url, 'https://cb.test/submit');
  assert.match(fetch.calls[0].init.body, /xdr=SIGNED/);
});

test('pay({ sign: true }) signs without submitting', async () => {
  const wallet = mockWallet();
  const client = new WebClient({ wallets: [wallet], stellarSdk: fakeStellarSdk() });
  const result = await client.pay(fakeIntent({ kind: 'PAY', amount: '1' }), {
    sign: true,
  });
  assert.equal(result.submitted, false);
  assert.equal(result.signedXdr, 'SIGNED(UNSIGNED_XDR)');
});

test('pay() requires an amount for an open PAY intent', async () => {
  const wallet = mockWallet();
  const client = new WebClient({ wallets: [wallet], stellarSdk: fakeStellarSdk() });
  await assert.rejects(
    () => client.pay(fakeIntent({ kind: 'PAY', amount: null })),
    /no fixed amount/,
  );
});

test('buildTransaction returns an unsigned XDR without prompting a signature', async () => {
  const wallet = mockWallet();
  const client = new WebClient({ wallets: [wallet], stellarSdk: fakeStellarSdk() });
  const { xdr, source } = await client.buildTransaction(
    fakeIntent({ kind: 'PAY', amount: '7' }),
  );
  assert.equal(xdr, 'UNSIGNED_XDR');
  assert.equal(source, wallet._pub);
  assert.equal(
    wallet.calls.some((c) => c[0] === 'signTransaction'),
    false,
  );
});

test('getAvailableWallets reflects adapter availability', async () => {
  const client = new WebClient({
    wallets: [
      mockWallet({ id: 'one', available: true }),
      mockWallet({ id: 'two', available: false }),
    ],
  });
  const wallets = await client.getAvailableWallets();
  assert.deepEqual(
    wallets.map((w) => [w.id, w.available]),
    [
      ['one', true],
      ['two', false],
    ],
  );
});

test('convenience methods require an apiKey', () => {
  const client = new WebClient();
  assert.throws(() => client.validate('pi_1', 'hash'), IntentError);
});
