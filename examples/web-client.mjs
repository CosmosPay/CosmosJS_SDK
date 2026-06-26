// Web client (browser) — complete a payment intent with the user's wallet.
//
// This is browser code: run it through a bundler (Vite, webpack, esbuild…) and
// load it in a page where a Stellar wallet extension (Freighter / xBull / Rabet)
// is installed. The provider is auto-detected — but you can also pin one.
//
//   npm install @cosmosapp/pay_sdk @stellar/stellar-sdk
//
import { WebClient } from '@cosmosapp/pay_sdk/web';

// The web client builds & submits transactions, so it uses the Stellar SDK.
// It's lazy-imported automatically when installed; nothing else to wire up.
const webClient = new WebClient();

// 1. Show the user which wallets are available (optional — pay() auto-detects).
const wallets = await webClient.getAvailableWallets();
console.log(
  'Detected wallets:',
  wallets.filter((w) => w.available).map((w) => w.name).join(', ') || 'none',
);

// 2. Get the intent your SERVER created (e.g. fetched from your backend).
//    For this example we fetch it from your backend; in real apps it comes
//    from `client.paymentIntents.createPay(...)` on the server.
const intent = await fetch('/api/create-intent', { method: 'POST' }).then((r) =>
  r.json(),
);

// 3. One call: detect wallet → adapt response → build tx → sign → submit.
try {
  const result = await webClient.pay(intent);
  console.log(`Paid via ${result.wallet} from ${result.account}`);
  console.log('Transaction hash:', result.txHash);

  // 4. Tell your server to finalize (it calls intent.validate(txHash)).
  await fetch('/api/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId: intent.id, txHash: result.txHash }),
  });
} catch (error) {
  // WalletNotFoundError, WalletError (user rejected / locked), IntentError…
  console.error('Payment failed:', error.message);
}

// ── Variations ────────────────────────────────────────────────────────────────

// Pin a specific provider instead of auto-detecting (per call):
//   await webClient.pay(intent, { wallet: 'xbull' });
// …or as the default for this client:
//   const webClient = new WebClient({ preferredWallets: ['xbull', 'freighter'] });

// Open-amount intent (e.g. a donation) — supply the amount:
//   await webClient.pay(intent, { amount: '5' });

// Inspect the transaction before prompting the wallet:
//   const { xdr, source } = await webClient.buildTransaction(intent);

// Sign without submitting (you broadcast yourself):
//   const { signedXdr } = await webClient.pay(intent, { sign: true });

// Enable Albedo / LOBSTR (no auto-detectable global) by injecting their libs:
//   import albedo from '@albedo-link/intent';
//   const webClient = new WebClient({ albedo });

// Interact with the Cosmos Pay API directly (TRUSTED environments only — this
// exposes your API key in the browser; prefer creating intents on your server):
//   const webClient = new WebClient({ apiKey: 'dv_test_only' });
//   const intent = await webClient.createPay({ destination: 'G...', amount: '10' });
//   await webClient.validate(intent.id, result.txHash);
