// Cosmos Wallet — the SDK's own wallet adapter and its Stellar Wallets Kit module.
// Fully offline: a fake `window.cosmosWallet` and a fake `document` stand in for the
// browser, so no extension, wallet origin or network is touched.
//
// The cases worth having here are the ones a browser would only show you by failing
// in front of a user: the kit's 1000ms availability budget, the refusal shape for a
// method this wallet does not implement, and the auto-detection ORDER — which is a
// decision, not an accident, and silently changes which wallet an existing
// integration signs with if it drifts.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CosmosWalletModule,
  COSMOS_WALLET_ID,
  SwkModuleType,
  injectedProvider,
  resolveProvider,
  resetProviderCache,
} from '../dist/swk/index.js';
import {
  CosmosWalletAdapter,
  WalletRegistry,
  defaultAdapters,
  Wallets,
  WalletError,
  PASSPHRASES,
} from '../dist/web/index.js';

// ── Fakes ────────────────────────────────────────────────────────────────────

/** A provider with the shape the real wallet injects, recording every call. */
function fakeProvider(overrides = {}) {
  const calls = [];
  const provider = {
    isCosmosWallet: true,
    calls,
    async getAddress() {
      calls.push(['getAddress']);
      return { address: 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6', network: 'TESTNET', networkPassphrase: PASSPHRASES.testnet };
    },
    async getNetwork() {
      calls.push(['getNetwork']);
      return { network: 'TESTNET', networkPassphrase: PASSPHRASES.testnet };
    },
    async signTransaction(xdr, opts) {
      calls.push(['signTransaction', xdr, opts]);
      return { signedTxXdr: `signed:${xdr}`, signerAddress: 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6' };
    },
    async signMessage(message, opts) {
      calls.push(['signMessage', message, opts]);
      return { signedMessage: 'c2lnbmF0dXJl', signerAddress: 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6', domain: 'Cosmos Wallet signed message v1' };
    },
    ...overrides,
  };
  return provider;
}

/** Install `window.cosmosWallet`, returning a restore function. */
function withWindow(provider) {
  const had = 'window' in globalThis;
  const previous = globalThis.window;
  globalThis.window = { cosmosWallet: provider };
  return () => {
    if (had) globalThis.window = previous;
    else delete globalThis.window;
  };
}

/**
 * A `document` that resolves a script tag by defining the provider — what the
 * hosted wallet's `cosmos-wallet.js` does when it loads.
 */
function withDocument({ provider, fail = false } = {}) {
  const appended = [];
  const had = 'document' in globalThis;
  const previous = globalThis.document;
  const head = {
    appendChild(tag) {
      appended.push(tag);
      // Asynchronous, like a real load: the provider is not there on the next line.
      setTimeout(() => {
        if (fail) return tag.handlers.error?.();
        globalThis.window.cosmosWallet = provider;
        tag.handlers.load?.();
      }, 1);
      return tag;
    },
  };
  globalThis.document = {
    head,
    documentElement: head,
    querySelector: () => null,
    createElement() {
      const tag = { handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } };
      return tag;
    },
  };
  return {
    appended,
    restore() {
      if (had) globalThis.document = previous;
      else delete globalThis.document;
    },
  };
}

const ADDRESS = 'GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6';

// ── The kit module: identity ─────────────────────────────────────────────────

test('the module identifies itself the way the kit renders it', () => {
  const module = new CosmosWalletModule();
  assert.equal(module.productId, COSMOS_WALLET_ID);
  assert.equal(module.productId, 'cosmos-wallet');
  assert.equal(module.productName, 'Cosmos Wallet');
  assert.match(module.productUrl, /^https:\/\//);
  assert.match(module.productIcon, /^https:\/\//);
  // Default is the same string the kit's enum holds, so a consumer who passes
  // nothing still gets a module the kit files under the right group.
  assert.equal(module.moduleType, SwkModuleType.HOT_WALLET);
  assert.equal(module.moduleType, 'HOT_WALLET');
});

test('the kit’s own ModuleType value passes straight through', () => {
  // How a TypeScript consumer avoids a cast: hand the kit's enum member in. The
  // runtime value is the same string either way.
  const module = new CosmosWalletModule({ moduleType: 'HOT_WALLET' });
  assert.equal(module.moduleType, 'HOT_WALLET');
  const overridden = new CosmosWalletModule({ productName: 'Cosmos', productIcon: 'https://x/i.png' });
  assert.equal(overridden.productName, 'Cosmos');
  assert.equal(overridden.productIcon, 'https://x/i.png');
});

// ── The kit module: availability ─────────────────────────────────────────────

test('availability answers inside the kit’s 1000ms budget, without loading anything', async () => {
  resetProviderCache();
  const doc = withDocument({ provider: fakeProvider() });
  const restore = withWindow(undefined);
  try {
    // A hosted wallet needs no install, so it is available — and saying so must not
    // wait for the script: the kit drops a module that takes longer than a second.
    const module = new CosmosWalletModule({ walletUrl: 'https://wallet.example' });
    const started = Date.now();
    assert.equal(await module.isAvailable(), true);
    assert.ok(Date.now() - started < 1000, 'isAvailable must not wait on the network');
    assert.equal(doc.appended.length, 0, 'nothing should be fetched to answer isAvailable');
  } finally {
    restore();
    doc.restore();
  }
});

test('nothing installed and nothing configured means unavailable', async () => {
  const restore = withWindow(undefined);
  try {
    assert.equal(await new CosmosWalletModule().isAvailable(), false);
  } finally {
    restore();
  }
});

test('an injected provider is available with no configuration at all', async () => {
  const restore = withWindow(fakeProvider());
  try {
    assert.equal(await new CosmosWalletModule().isAvailable(), true);
  } finally {
    restore();
  }
});

// ── The kit module: the methods ──────────────────────────────────────────────

test('getAddress returns the wallet address', async () => {
  const provider = fakeProvider();
  const module = new CosmosWalletModule({ provider });
  assert.deepEqual(await module.getAddress(), { address: ADDRESS });
});

test('signTransaction forwards the passphrase and returns the signed envelope', async () => {
  const provider = fakeProvider();
  const module = new CosmosWalletModule({ provider });
  const result = await module.signTransaction('AAAAAgAAAAB', { networkPassphrase: PASSPHRASES.public });
  assert.equal(result.signedTxXdr, 'signed:AAAAAgAAAAB');
  assert.equal(result.signerAddress, ADDRESS);
  // Forwarded, not authoritative: the wallet signs against its OWN network and
  // refuses a mismatch, so passing this is how a wrong-network request becomes a
  // visible error instead of a signature for a network nobody asked for.
  assert.equal(provider.calls.at(-1)[2].networkPassphrase, PASSPHRASES.public);
});

test('a wallet that returns no signature is an error, never an empty success', async () => {
  const provider = fakeProvider({ async signTransaction() { return {}; } });
  const module = new CosmosWalletModule({ provider });
  await assert.rejects(() => module.signTransaction('AAAA'), /no signed transaction/i);
});

test('signMessage returns the signature', async () => {
  const module = new CosmosWalletModule({ provider: fakeProvider() });
  const result = await module.signMessage('hello');
  assert.equal(result.signedMessage, 'c2lnbmF0dXJl');
  assert.equal(result.signerAddress, ADDRESS);
});

test('signAuthEntry refuses in the kit’s own vocabulary', async () => {
  // Cosmos Wallet cannot sign Soroban auth entries. Anything returned instead of a
  // refusal would be a signature the network rejects — discovered by the user
  // rather than by the dapp. `-3` is the code the kit's own modules use.
  const module = new CosmosWalletModule({ provider: fakeProvider() });
  await assert.rejects(
    () => module.signAuthEntry('AAAA'),
    (error) => {
      assert.equal(error.code, -3);
      assert.match(error.message, /does not support the "signAuthEntry" function/);
      assert.ok(error instanceof Error);
      return true;
    },
  );
});

test('getNetwork reports the network the wallet is actually on', async () => {
  const module = new CosmosWalletModule({ provider: fakeProvider() });
  assert.deepEqual(await module.getNetwork(), { network: 'TESTNET', networkPassphrase: PASSPHRASES.testnet });
});

test('an unreachable wallet fails with the kit’s error shape', async () => {
  const restore = withWindow(undefined);
  try {
    const module = new CosmosWalletModule();
    await assert.rejects(
      () => module.getAddress(),
      (error) => {
        assert.equal(typeof error.code, 'number');
        assert.match(error.message, /not available/i);
        return true;
      },
    );
  } finally {
    restore();
  }
});

// ── The hosted transport ─────────────────────────────────────────────────────

test('the hosted provider is fetched once, on first use, and shared', async () => {
  resetProviderCache();
  const provider = fakeProvider();
  const doc = withDocument({ provider });
  const restore = withWindow(undefined);
  try {
    const module = new CosmosWalletModule({ walletUrl: 'https://wallet.example/' });
    // Two calls in the same tick — a kit rendering its modal does exactly this.
    const [a, b] = await Promise.all([module.getAddress(), module.getAddress()]);
    assert.equal(a.address, ADDRESS);
    assert.equal(b.address, ADDRESS);
    assert.equal(doc.appended.length, 1, 'two script tags for one provider is a race');
    assert.equal(doc.appended[0].src, 'https://wallet.example/cosmos-wallet.js');
  } finally {
    restore();
    doc.restore();
    resetProviderCache();
  }
});

test('a wallet origin that fails to load is retried, not remembered as broken', async () => {
  resetProviderCache();
  const failing = withDocument({ fail: true });
  const restore = withWindow(undefined);
  try {
    assert.equal(await resolveProvider({ walletUrl: 'https://down.example' }), undefined);
    assert.equal(failing.appended.length, 1);
    // Second attempt must actually try again — a memoised failure would make the
    // wallet permanently unavailable for the life of the page.
    assert.equal(await resolveProvider({ walletUrl: 'https://down.example' }), undefined);
    assert.equal(failing.appended.length, 2);
  } finally {
    restore();
    failing.restore();
    resetProviderCache();
  }
});

test('an explicitly supplied provider is never probed for', async () => {
  const restore = withWindow(undefined);
  const doc = withDocument({ provider: fakeProvider() });
  try {
    const provider = fakeProvider();
    assert.equal(await resolveProvider({ provider, walletUrl: 'https://wallet.example' }), provider);
    assert.equal(doc.appended.length, 0);
  } finally {
    restore();
    doc.restore();
  }
});

test('injectedProvider reads the extension global, and nothing else', () => {
  const restore = withWindow(fakeProvider());
  try {
    assert.ok(injectedProvider());
  } finally {
    restore();
  }
  const gone = withWindow(undefined);
  try {
    assert.equal(injectedProvider(), undefined);
  } finally {
    gone();
  }
});

// ── The SDK's own wallet adapter ─────────────────────────────────────────────

test('the adapter signs through the provider', async () => {
  const provider = fakeProvider();
  const adapter = new CosmosWalletAdapter(provider);
  assert.equal(adapter.id, Wallets.COSMOS);
  assert.equal(adapter.name, 'Cosmos Wallet');
  assert.equal(await adapter.isAvailable(), true);
  assert.equal(await adapter.getPublicKey({ network: 'testnet' }), ADDRESS);
  const signed = await adapter.signTransaction('AAAA', { networkPassphrase: PASSPHRASES.testnet, network: 'testnet' });
  assert.equal(signed, 'signed:AAAA');
});

test('a wallet failure surfaces as a WalletError naming the wallet', async () => {
  const provider = fakeProvider({
    async signTransaction() {
      throw new Error('The user rejected the request.');
    },
  });
  const adapter = new CosmosWalletAdapter(provider);
  await assert.rejects(
    () => adapter.signTransaction('AAAA', { networkPassphrase: PASSPHRASES.testnet, network: 'testnet' }),
    (error) => {
      assert.ok(error instanceof WalletError);
      assert.match(error.message, /rejected/i);
      return true;
    },
  );
});

test('the adapter is registered by default, and detection order is not an accident', async () => {
  const ids = defaultAdapters().map((a) => a.id);
  assert.ok(ids.includes(Wallets.COSMOS));
  // LAST, deliberately: auto-detection takes the first available adapter, so
  // putting the first-party wallet at the front would move an existing integration
  // off Freighter the day its user installs Cosmos Wallet. Preference is opt-in.
  assert.equal(ids.at(-1), Wallets.COSMOS);
  assert.deepEqual(ids, ['freighter', 'xbull', 'rabet', 'lobstr', 'albedo', 'cosmos']);
});

test('the registry picks Cosmos Wallet when it is the one that is there', async () => {
  const registry = new WalletRegistry(defaultAdapters({ cosmos: fakeProvider() }));
  const restore = withWindow(undefined);
  try {
    const picked = await registry.detect();
    assert.equal(picked.id, Wallets.COSMOS);
  } finally {
    restore();
  }
});
