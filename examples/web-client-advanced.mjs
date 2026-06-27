// Web client (browser) — advanced flows beyond the one-call `pay()`:
// inspect/choose wallets, build-before-sign, sign-only, custom adapters,
// dependency injection, and calling the API directly.
//
// This is BROWSER code — run it through a bundler (Vite, webpack, esbuild…).
//   npm install @cosmosapp/pay_sdk @stellar/stellar-sdk
import { WebClient, Wallets } from '@cosmosapp/pay_sdk/web';

const webClient = new WebClient();

// 1. Inspect which wallets are available (auto-detected ones report `available`).
const wallets = await webClient.getAvailableWallets();
console.log('wallets:', wallets.map((w) => `${w.name}${w.available ? '' : ' (n/a)'}`).join(', '));

// 2. Just connect (e.g. to show the address) without paying.
const { wallet, address, network } = await webClient.connect();
console.log(`connected ${wallet} ${address} on ${network}`);

// `intent` is the payload your SERVER created (createPay/createTx). For brevity
// we fetch it from your backend here.
const intent = await fetch('/api/create-intent', { method: 'POST' }).then((r) => r.json());

// 3. Build the transaction WITHOUT signing — render a confirmation UI first.
const { xdr, source } = await webClient.buildTransaction(intent);
console.log('about to sign from', source, '· xdr bytes:', xdr.length);

// 4. Pin a specific provider for one call (instead of auto-detecting).
//    Or set the default order: new WebClient({ preferredWallets: [Wallets.XBULL] }).
const result = await webClient.pay(intent, { wallet: Wallets.FREIGHTER });
console.log(`paid via ${result.wallet}: ${result.txHash} (submitted=${result.submitted})`);

// 5. Open-amount intent (donation): supply the amount at pay time.
//    await webClient.pay(intent, { amount: '5' });

// 6. Sign WITHOUT submitting (you broadcast yourself).
//    const { signedXdr } = await webClient.pay(intent, { sign: true });

// ── Custom wallet adapter (WalletConnect / Ledger / your own signer) ────────────
const myWallet = {
  id: 'my-wallet',
  name: 'My Wallet',
  async isAvailable() { return Boolean(globalThis.myWallet); },
  async getPublicKey() { return globalThis.myWallet.getAddress(); },
  async signTransaction(xdr, { networkPassphrase }) {
    return globalThis.myWallet.sign(xdr, networkPassphrase);
  },
};
webClient.registerWallet(myWallet, /* prepend (win auto-detection) */ true);

// ── Dependency injection (advanced / SSR / bundle control) ──────────────────────
// Nothing is imported eagerly. Inject the Stellar SDK + wallet libs so the
// bundler sees explicit imports:
//   import * as StellarSdk from '@stellar/stellar-sdk';
//   import freighter from '@stellar/freighter-api';
//   import albedo from '@albedo-link/intent';
//   const wc = new WebClient({ stellarSdk: StellarSdk, freighter, albedo });

// ── Talking to the API directly (TRUSTED environments only) ─────────────────────
// Ships your API key to the browser — only for prototypes/internal tools with a
// scoped testnet `dv_` key. For production, create/validate intents on your server.
//   const wc = new WebClient({ apiKey: 'dv_test_only' });
//   const created = await wc.createPay({ destination: 'G...', amount: '10' });
//   const r = await wc.pay(created);
//   const outcome = await wc.validate(created.id, r.txHash);
