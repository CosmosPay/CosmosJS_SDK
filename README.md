<div align="center">

# 🪐 @cosmosapp/pay_sdk

**The object-oriented JavaScript / TypeScript SDK for the [Cosmos Pay](#) Payments API**

Stellar **SEP-7 payment intents** · **webhooks** · **products** · **customers** · **analytics**

[![CI](https://github.com/CosmosPay/CosmosJS_SDK/actions/workflows/ci.yml/badge.svg)](https://github.com/CosmosPay/CosmosJS_SDK/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@cosmosapp/pay_sdk?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/@cosmosapp/pay_sdk)
[![npm downloads](https://img.shields.io/npm/dm/@cosmosapp/pay_sdk?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/@cosmosapp/pay_sdk)
[![types](https://img.shields.io/npm/types/@cosmosapp/pay_sdk?style=flat-square&color=3178c6)](https://www.npmjs.com/package/@cosmosapp/pay_sdk)
[![node](https://img.shields.io/node/v/@cosmosapp/pay_sdk?style=flat-square&color=339933)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-Source--Available-22c55e?style=flat-square)](./LICENSE)

</div>

---

Designed to be **atomic**: one `Client`, every resource split into its own manager, and rich
structure classes that can act on themselves.

The SDK ships **two entry points** for the two halves of a payment:

| Import | Where it runs | What it does |
| ------ | ------------- | ------------ |
| `@cosmosapp/pay_sdk` | **server** (Node ≥ 18) | Create & manage SEP-7 payment intents, webhooks, products, customers, analytics — everything that needs your secret API key. |
| `@cosmosapp/pay_sdk/web` | **browser** | *Complete* an intent: auto-detect the user's Stellar wallet (Freighter, xBull, Rabet, LOBSTR, Albedo…), adapt the response into a transaction, request a signature and submit — **provider-agnostic, no provider argument**. |

```ts
// ── server ──────────────────────────────────────────────────────────
import { Client } from '@cosmosapp/pay_sdk';

// You only bring your API key — the gateway URL and other internals are pre-configured for you.
const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });

const intent = await client.paymentIntents.createPay({ destination: 'G...', amount: '10' });
console.log(intent.uri); // web+stellar:pay?destination=...
```

```ts
// ── browser ─────────────────────────────────────────────────────────
import { WebClient } from '@cosmosapp/pay_sdk/web';

// `intent` is the payload your server returned above. No wallet/provider to choose.
const webClient = new WebClient();
const { txHash, account, wallet } = await webClient.pay(intent);
console.log(`Paid via ${wallet} from ${account}: ${txHash}`);
```

> 📚 **Runnable examples** for every feature live in [`examples/`](./examples)
> (one file per area — payment intents, web client, webhooks, products, customers,
> analytics, errors, …). See [`examples/README.md`](./examples/README.md).
>
> 🤖 **Using an AI assistant?** Atomic, AI-readable docs live in the isolated
> [`llms/`](./llms) folder ([`llms.txt`](./llms/llms.txt) index + per-topic files +
> a combined [`llms-full.txt`](./llms/llms-full.txt)) — point your tool at them to
> make integrating the SDK much easier. After install they're at
> `node_modules/@cosmosapp/pay_sdk/llms/`.

## ✨ Features

- ✅ **TypeScript & JavaScript** — full typings, works in both **CJS** and **ESM**.
- ✅ **Zero runtime dependencies** — native `fetch` + `node:crypto`, nothing else.
- ✅ **Atomic API** — one client, one manager per resource: `client.paymentIntents`, `client.webhooks`, …
- ✅ **Self-acting structures** — `intent.validate()`, `endpoint.rotateSecret()`, `product.deactivate()`.
- ✅ **Built-in webhook signature verification** + ready-made `http` / Express handlers.
- ✅ **Resilient by default** — automatic retries, timeouts and structured errors.
- ✅ **Browser web client** — auto-detects Freighter, xBull, Rabet, LOBSTR & Albedo, builds the
  transaction from the SEP-7 response and signs it. Agnostic — you never pass a provider.

## 📑 Table of contents

- [Installation](#-installation)
- [Authentication](#-authentication)
- [Quick start](#-quick-start)
- [The client at a glance](#-the-client-at-a-glance)
- [Web client (browser wallets)](#-web-client-browser-wallets)
- [Payment intents](#-payment-intents)
- [Typed assets, wallets & addresses](#-typed-assets-wallets--addresses)
- [Webhooks](#-webhooks)
- [Products & customers](#-products--customers)
- [Analytics & health](#-analytics--health)
- [Error handling](#-error-handling)
- [Observability](#-observability)
- [Configuration reference](#-configuration-reference)
- [TypeScript](#-typescript)
- [Running the tests locally](#-running-the-tests-locally)
- [CI/CD & publishing](#-cicd--publishing)
- [License](#-license)

## 📦 Installation

```bash
npm install @cosmosapp/pay_sdk
# or
pnpm add @cosmosapp/pay_sdk
# or
yarn add @cosmosapp/pay_sdk
```

Requires **Node.js ≥ 18** (for the global `fetch`). On older runtimes pass a `fetch` polyfill via the `fetch` option.

## 🔑 Authentication

**You only need your API key.** Everything else — the gateway URL, the API version, and other
infrastructure details — is part of the SDK's **shared configuration**, maintained by Cosmos Pay
and filled in for you.

```ts
const client = new Client({
  apiKey: 'prod_xxx', // or dv_xxx for testnet
});
```

The **network** (testnet vs mainnet) is determined by the API key type
(`dv_` → testnet, `prod_` → mainnet) — you don't configure it.

<details>
<summary><b>Shared configuration (advanced)</b></summary>

The internal defaults live in `Client.shared` and can be overridden globally (once, at startup) —
useful for self-hosting or pointing at a staging gateway:

```ts
import { Client } from '@cosmosapp/pay_sdk';

Client.shared.baseURL = 'https://gateway.your-domain.com'; // e.g. a self-hosted gateway
// every client created afterwards inherits this
// (the default is the public gateway: https://api.cosmospay.lat/cosmos-api)
```

Or per-client (rarely needed):

```ts
const client = new Client({
  apiKey: '...',
  baseURL: 'http://localhost:3000', // override the gateway
  // direct, gateway-bypassing access for local dev:
  gatewaySecret: process.env.APISIX_GATEWAY_SECRET,
  consumerUsername: 'cosmos_demo',
});
```

These overrides (`baseURL`, `version`, `gatewaySecret`, `consumerUsername`) are all optional — a
normal integration never sets them.

</details>

## 🚀 Quick start

```ts
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });

// Create a SEP-7 `pay` intent (no source → URI + QR)
const pay = await client.paymentIntents.createPay({
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '120.1234567',
  assetCode: 'USDC',
  assetIssuer: 'GCRCUE2C5TBNIPYHMEP7NK5RWTT2WBSZ75CMARH7GDOHDDCQH3XANFOB',
  msg: 'Order #24',
});

console.log(pay.uri); // web+stellar:pay?destination=...
console.log(pay.qr);  // data:image/png;base64,...

// Later, validate a submitted transaction against the intent
const outcome = await pay.validate('3389e9f0d6b3e3f1c2a1...');
if (outcome.valid) console.log('Settled!', outcome.status);
```

## 🧭 The client at a glance

| Manager                  | Resource                          | Key methods |
| ------------------------ | --------------------------------- | ----------- |
| `client.paymentIntents`  | Stellar SEP-7 payment intents     | `createTx` · `createPay` · `fetch` · `list` · `update` · `delete` · `validate` |
| `client.webhooks`        | Webhook endpoints + deliveries    | `create` · `list` · `fetch` · `rotateSecret` · `ping` · `on(...)` · `process` |
| `client.products`        | Products / prices                 | `create` · `list` · `fetch` · `update` · `delete` |
| `client.customers`       | Customers                         | `create` · `list` · `fetch` · `update` · `delete` |
| `client.analytics`       | Read-only metrics & logs          | `summary` · `balances` · `apiLogs` · `webhookLogs` |
| `client.health`          | Liveness / readiness probes       | `liveness` · `readiness` |

## 🌐 Web client (browser wallets)

The server SDK *creates* intents. The **web client** *completes* them in the user's browser.

Stellar browser wallets (Freighter, xBull, Rabet, LOBSTR, Albedo…) **don't ingest SEP-7
`web+stellar:` URIs from a dapp** — each exposes its own JS API. The web client bridges that gap: it
**auto-detects** whichever wallet the user has, **adapts** the Cosmos Pay response into a concrete
Stellar transaction (building the payment for `pay` intents, reusing the XDR for `tx` intents), asks
the wallet to **sign**, and **submits** to Horizon (or POSTs to the SEP-7 `callback`). You never
*have to* pass a provider — it's fully agnostic — but you **can** pin one when you want (see
[Inspecting & choosing wallets](#inspecting--choosing-wallets)).

```bash
# the web client builds/submits transactions, so it needs the Stellar SDK (optional peer dep)
npm install @cosmosapp/pay_sdk @stellar/stellar-sdk
```

### The typical flow

1. **Server** creates the intent (with your secret key) and sends the payload to your frontend.
2. **Browser** completes it — one call:

```ts
import { WebClient } from '@cosmosapp/pay_sdk/web';

const webClient = new WebClient();           // auto-detects the wallet

// `intent` may be the PaymentIntent payload from your server, a PaymentIntent
// instance, or even the raw `web+stellar:` URI string.
const result = await webClient.pay(intent);

console.log(result.wallet);    // 'freighter' | 'xbull' | 'rabet' | 'lobstr' | 'albedo' | ...
console.log(result.account);   // the G... account that signed
console.log(result.txHash);    // the on-chain transaction hash
console.log(result.submitted); // true
```

3. Report `result.txHash` back to your server and finalize with `intent.validate(txHash)` (or call
   `webClient.validate(...)`, see below).

### Supported wallets

Auto-detected with **zero config** (they inject a browser global):

| Wallet | id | Detection |
| ------ | -- | --------- |
| **Freighter** | `freighter` | `window.freighterApi` (extension) |
| **xBull** | `xbull` | `window.xBullSDK` (extension) |
| **Rabet** | `rabet` | `window.rabet` (extension) |

Enabled by **passing their library** (no reliable global to sniff):

| Wallet | id | How to enable |
| ------ | -- | ------------- |
| **Albedo** | `albedo` | `new WebClient({ albedo })` — `import albedo from '@albedo-link/intent'` |
| **LOBSTR** | `lobstr` | `new WebClient({ lobstr })` — `import * as lobstr from '@lobstrco/signer-extension-api'` |

Bring **any other** wallet (WalletConnect, Ledger, a custom signer) by implementing the small
`WalletAdapter` interface and registering it — see [Custom wallets](#custom-wallets).

### Inspecting & choosing wallets

Detection is automatic by default, **but the provider can also be defined** — per call, or as the
client's preferred order:

```ts
import { Wallets } from '@cosmosapp/pay_sdk/web';

const wallets = await webClient.getAvailableWallets();
// [{ id: 'freighter', name: 'Freighter', available: true }, { id: 'xbull', … }, …]

// Just connect (e.g. to show the address) without paying:
const { wallet, address, network } = await webClient.connect();

// Pin a specific provider for one call:
await webClient.pay(intent, { wallet: Wallets.XBULL });

// …or set the default order for this client:
const pinned = new WebClient({ preferredWallets: [Wallets.XBULL, Wallets.FREIGHTER] });
```

### `tx` vs `pay` intents

- **`pay` intent** (no source): the client builds a payment transaction from the **connected account**
  as source — loading its sequence from Horizon, adding the payment op + memo, fee and timebounds.
  For an open-amount intent (e.g. a donation) pass the amount: `webClient.pay(intent, { amount: '5' })`.
- **`tx` intent** (source known, XDR present): the client signs the **returned XDR** as-is. If the
  connected wallet isn't the intent's `source`, it throws a clear error so you can prompt an account
  switch.

Want to show the user the transaction before signing? Build without prompting:

```ts
const { xdr, source, network } = await webClient.buildTransaction(intent);
// …render a confirmation…
const result = await webClient.pay(intent); // or sign the xdr yourself
```

`webClient.pay(intent, { sign: true })` signs **without** submitting (returns `signedXdr`); `{ submit: false }`
also skips submission.

### Network detection

The network (mainnet/testnet), passphrase and Horizon endpoint are **inferred from the intent**
(its `network` field / the SEP-7 `network_passphrase`). Override if you self-host Horizon:

```ts
new WebClient({ network: 'testnet', horizonUrl: 'https://horizon-testnet.stellar.org' });
```

### Custom wallets

```ts
import { WebClient, type WalletAdapter } from '@cosmosapp/pay_sdk/web';

const myWallet: WalletAdapter = {
  id: 'my-wallet',
  name: 'My Wallet',
  async isAvailable() { return Boolean(globalThis.myWallet); },
  async getPublicKey() { return globalThis.myWallet.getAddress(); },
  async signTransaction(xdr, { networkPassphrase }) {
    return globalThis.myWallet.sign(xdr, networkPassphrase);
  },
};

const webClient = new WebClient();
webClient.registerWallet(myWallet, /* prepend (win auto-detection) */ true);
```

### Talking to the API directly (optional — trusted environments only)

The web client can **also call the Cosmos Pay API directly** — creating and validating intents from
the browser — by passing an `apiKey`. This is handy for prototypes, internal tools and other
**trusted environments**.

> ⚠️ **Not recommended for public/production frontends.** Doing this ships your API key to the
> browser, where anyone can read it. Only enable it when the environment is trusted and the key is
> safe to expose (e.g. a scoped testnet `dv_` key). For production, **create and validate intents on
> your server** and let the web client only sign/submit.

```ts
const webClient = new WebClient({ apiKey: 'dv_test_only' }); // trusted env only
const intent = await webClient.createPay({ destination: 'G...', amount: '10' });
const result = await webClient.pay(intent);
const outcome = await webClient.validate(intent.id, result.txHash);
```

### Inject everything (advanced / SSR / bundle control)

Nothing is imported eagerly. You can inject the Stellar SDK and any wallet library so the bundler
sees explicit imports:

```ts
import * as StellarSdk from '@stellar/stellar-sdk';
import freighter from '@stellar/freighter-api';

const webClient = new WebClient({ stellarSdk: StellarSdk, freighter });
```

## 💳 Payment intents

```ts
// tx intent (source known → unsigned XDR + tx URI + QR)
const tx = await client.paymentIntents.createTx({
  source: 'G...PAYER',
  destination: 'G...MERCHANT',
  amount: '25.5',
  memo: '123456789',         // optional MEMO_ID (auto-generated otherwise)
});
console.log(tx.xdr, tx.uri, tx.qr);

// pay intent (no source) — typed asset, no issuer to look up
import { Assets } from '@cosmosapp/pay_sdk';
const pay = await client.paymentIntents.createPay({
  destination: 'G...',
  amount: '10',
  asset: Assets.USDC, // fills assetCode + the verified issuer for you
});

// fetch one
const intent = await client.paymentIntents.fetch('pi_123');

// list (paginated + filtered)
const page = await client.paymentIntents.list({ status: 'SUCCEEDED', take: 50, skip: 0 });
console.log(page.items, page.total);

// update / cancel / delete
await intent.edit({ reference: 'order_1234' });
await intent.cancel();
await intent.delete();

// validate a submitted tx (finalizes status + fires webhook)
const outcome = await intent.validate('<txHash>');
```

Each `PaymentIntent` exposes typed helpers: `isTx`, `isPay`, `isSucceeded`, `isPending`, `assetLabel`,
and the action methods `fetch()`, `edit()`, `validate()`, `cancel()`, `delete()`.

## 🎨 Typed assets, wallets & addresses

So you never paste the wrong issuer or a magic string, the SDK ships small **typed, extensible
catalogs** — and a plain string still works everywhere. These are exported from **both** entry points
(`@cosmosapp/pay_sdk` and `@cosmosapp/pay_sdk/web`).

**Assets** — common assets with their **verified issuers** baked in (no contract/issuer hunting):

```ts
import { Assets, defineAsset, TestnetAssets } from '@cosmosapp/pay_sdk';

Assets.XLM;   // native lumens
Assets.USDC;  // { code: 'USDC', issuer: 'GA5Z…' }  (Circle, mainnet — verified)
Assets.EURC;  // { code: 'EURC', issuer: 'GDHU…' }

// Need another asset? Define it once (issuer/contract are validated):
const AQUA = defineAsset({ code: 'AQUA', issuer: 'GBNZ…ILCT', name: 'Aquarius' });

await client.paymentIntents.createPay({ destination: 'G...', amount: '5', asset: AQUA });

// Plain code strings still work (treated as code-only):
await client.paymentIntents.createPay({ destination: 'G...', amount: '5', assetCode: 'USDC', assetIssuer: 'G...' });

// Testnet issuers live in TestnetAssets.* (e.g. TestnetAssets.USDC).
```

> ⚠️ Issuers are network-specific. `Assets.*` targets **mainnet**; use `TestnetAssets.*` for testnet.

**Wallets** — typed ids instead of magic strings:

```ts
import { WebClient, Wallets } from '@cosmosapp/pay_sdk/web';

const webClient = new WebClient({ preferredWallets: [Wallets.XBULL, Wallets.FREIGHTER] });
await webClient.pay(intent, { wallet: Wallets.FREIGHTER }); // pin a provider for one call
```

**Addresses** — name the accounts you use a lot and reference them by name; values are validated, and
anything unknown passes through unchanged (so raw `G…`, muxed `M…` and federation addresses keep
working):

```ts
import { addresses } from '@cosmosapp/pay_sdk';

addresses.define('merchant', 'GC...PAYOUT');
await client.paymentIntents.createPay({ destination: 'merchant', amount: '10' });

// validation helpers, too:
import { isStellarAddress } from '@cosmosapp/pay_sdk';
isStellarAddress('GC...'); // true
```

## 🔔 Webhooks

```ts
// register an endpoint — the secret is returned ONCE
const endpoint = await client.webhooks.create({
  url: 'https://me.example.com/hooks/cosmos',
  eventTypes: ['PAYMENT_INTENT_SUCCEEDED', 'PAYMENT_INTENT_FAILED'],
});
console.log(endpoint.secret); // whsec_... — store it now!

// manage it
await endpoint.disable();
await endpoint.enable();
await endpoint.ping();
const rotated = await endpoint.rotateSecret();
console.log(rotated.secret);

// audit trail
const deliveries = await endpoint.fetchDeliveries({ status: 'FAILED' });
for (const d of deliveries.items) await d.redeliver();

await endpoint.delete();
```

### Receiving events — `client.webhooks.on(...)`

Subscribe to events with the atomic event API. You can listen with the raw type, its camelCase alias, or
`event` for everything:

```ts
client.webhooks.on('paymentIntentSucceeded', (event) => {
  console.log('Paid!', event.data.id, event.data.amount);
});

client.webhooks.on('PAYMENT_INTENT_FAILED', (event) => { /* ... */ });

client.webhooks.on('event', (event) => {
  console.log('any event:', event.type);
});
```

Then feed incoming HTTP requests into the listener. The SDK verifies the HMAC signature for you and
dispatches the event. Set the secret once on the client (or pass `{ secret }` to the handler):

```ts
const client = new Client({
  apiKey: process.env.COSMOS_PAY_API_KEY,
  webhookSecret: process.env.COSMOS_WEBHOOK_SECRET, // the whsec_... from create/rotate
});
```

**Node.js `http` (zero dependencies):**

```ts
import { createServer } from 'node:http';

createServer(client.webhooks.createHandler()).listen(4242);
// → verifies the signature, emits the event, replies 200 (or 400 on a bad signature)
```

**Express:**

```ts
import express from 'express';
const app = express();

// must receive the RAW body so the signature matches
app.post(
  '/hooks/cosmos',
  express.raw({ type: '*/*' }),
  client.webhooks.middleware(),
  (req, res) => {
    // req.cosmosEvent is the verified event; listeners have already fired
    res.sendStatus(200);
  },
);
```

### Verifying signatures manually

Prefer to handle dispatch yourself? Use the lower-level helpers. The dispatcher signs each POST with
`X-Cosmos-Signature: t=<unixSeconds>,v1=<hmacSha256>`:

```ts
import { Webhooks } from '@cosmosapp/pay_sdk';

const event = Webhooks.constructEvent(
  rawBody,                           // RAW body (Buffer or string)
  req.header('X-Cosmos-Signature'),
  process.env.COSMOS_WEBHOOK_SECRET,
);
```

`Webhooks.verify(rawBody, header, secret)` returns `true` or throws;
`Webhooks.constructEvent(...)` verifies **and** parses the JSON event. Both accept a
`{ toleranceSeconds }` option (default 300s replay window). Equivalently,
`client.webhooks.process(rawBody, header, { secret })` does the same and emits the event to your
`on(...)` listeners.

## 🛍️ Products & customers

```ts
const product = await client.products.create({
  name: 'Pro plan — monthly',
  amount: '49.00',
  assetCode: 'USDC',
  kind: 'recurring',
});
await product.deactivate();

const customer = await client.customers.create({
  name: 'Acme Inc.',
  email: 'billing@acme.com',
  account: 'G...',
});
await customer.edit({ note: 'VIP, net-30' });
const customers = await client.customers.list(); // includes payment stats
```

## 📊 Analytics & health

```ts
const summary  = await client.analytics.summary();   // totals, volume, webhook health, 30-day series
const balances = await client.analytics.balances();  // settled + pending per asset
const apiLogs  = await client.analytics.apiLogs();
const hookLogs = await client.analytics.webhookLogs();

await client.health.liveness();   // true
const ready = await client.health.readiness(); // { status, info, details }
```

## ⚠️ Error handling

```ts
import { CosmosPayAPIError, CosmosPayRequestError } from '@cosmosapp/pay_sdk';

try {
  await client.paymentIntents.fetch('missing');
} catch (err) {
  if (err instanceof CosmosPayAPIError) {
    console.error(err.status, err.code, err.body); // e.g. 404
  } else if (err instanceof CosmosPayRequestError) {
    console.error('Network/timeout:', err.cause);
  }
}
```

Transient failures (network errors, `408`, `429`, `5xx`) are retried automatically
(default 2 retries, honoring `Retry-After`).

## 📡 Observability

The client re-emits REST telemetry:

```ts
client.on('request',     ({ method, url }) => {});
client.on('response',    ({ status, url }) => {});
client.on('rateLimited', ({ url }) => {});
```

## ⚙️ Configuration reference

```ts
new Client({
  apiKey: 'prod_xxx',            // required — the only thing you normally set
  webhookSecret: 'whsec_...',    // default secret for the webhook listener
  timeout: 30_000,               // ms
  retries: 2,
  headers: { 'X-Trace': 'abc' }, // extra headers on every request
  fetch: customFetch,            // custom fetch implementation

  // Advanced / internal — pre-filled from Client.shared, rarely overridden:
  baseURL: 'https://api.cosmospay.lat/cosmos-api', // gateway URL (default)
  version: 'v1',                 // route prefix
  gatewaySecret: '...',          // direct access (X-Gateway-Secret)
  consumerUsername: '...',       // direct access (X-Consumer-Username)
});
```

## 🧩 TypeScript

Everything is fully typed. Import option/entity types and enums directly:

```ts
import {
  Client,
  PaymentIntentStatus,
  WebhookEventType,
  type CreateTxPaymentIntentOptions,
  type PaymentIntentData,
} from '@cosmosapp/pay_sdk';
```

## 🧪 Running the tests locally

The test suite runs **entirely offline** with the built-in Node test runner (`node:test`) — no network,
no API key and no extra dependencies. Every HTTP call is served by an injected fake `fetch`, and the
webhook tests sign payloads with real `node:crypto`.

```bash
npm install      # dev deps only (typescript, tsup, …)
npm test         # builds the SDK, then runs node --test
```

What's covered:

| Suite                        | What it verifies |
| ---------------------------- | ---------------- |
| `test/client.test.mjs`       | construction, required `apiKey`, shared-config resolution, auth headers, telemetry events |
| `test/rest.test.mjs`         | URL/version building, query serialization, retry on `429`/`5xx`, structured errors |
| `test/payment-intents.test.mjs` | `createTx`/`createPay`/`fetch`/`list`/`validate`, request bodies, caching, structure helpers |
| `test/webhooks.test.mjs`     | HMAC `verify`/`constructEvent`, replay tolerance, `on(...)` dispatch, bad-signature rejection |
| `test/structures.test.mjs`   | `PaymentIntent` accessors, `toJSON`, `valueOf`, error classes |

Run a single file while developing:

```bash
node --test test/webhooks.test.mjs
```

> The `pretest` hook builds `dist/` first, so the tests exercise the exact artifact that gets published to npm.

## 🤖 CI/CD & publishing

This repo ships two GitHub Actions workflows under [`.github/workflows/`](./.github/workflows):

| Workflow | Trigger | What it does |
| -------- | ------- | ------------ |
| **`ci.yml`** | every push & PR to `main` | `npm ci` → typecheck → build → test, on Node **18 / 20 / 22** |
| **`release.yml`** | every push to `main` (or manual run) | **auto-detects a version bump** → typecheck → test → `npm publish --provenance`; skips if the version is unchanged |

Publishing is **fully automatic**: there's no Release to create and no tag to push. `release.yml`
runs on every push to `main`, compares `package.json`'s version against what's already on npm, and
publishes only when it's new. Unchanged version → the job skips cleanly (no red ❌).

### One-time setup (the GitHub environment variable)

1. **Create an npm automation token** — npm → _Access Tokens_ → _Generate New Token_ → **Automation**
   (or a _Granular_ token with publish rights for `@cosmosapp/pay_sdk`). The token's account must be a
   member of the **`@cosmosapp`** npm organization.
2. **Add it to GitHub** — repo → _Settings_ → _Secrets and variables_ → _Actions_ →
   **New repository secret**, named exactly:

   ```
   NPM_TOKEN
   ```

   The `release.yml` job reads it as `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`.
   It's scoped to a `release` [Environment](https://docs.github.com/actions/deployments/managing-environments-for-deployment) —
   create an Environment called **`release`** and add the secret there (or remove the
   `environment: release` line from the workflow to use a plain repo secret instead).

### Shipping a new version

```bash
npm version patch        # or minor / major — bumps package.json (+ git tag)
git push --follow-tags   # push to main → release.yml publishes automatically
```

That's it. The job **never republishes an existing version** (it checks npm first), so re-running or
pushing unrelated commits is always safe. Packages ship with
[**npm provenance**](https://docs.npmjs.com/generating-provenance-statements) (`id-token: write` +
`--provenance`), giving consumers a verifiable link back to this repo and commit.

> **First publish:** the `@cosmosapp` org and the `NPM_TOKEN` secret must exist before the first run.
> Because the name is scoped, `publishConfig.access` is set to `public` so it isn't published private.

> Only `dist/`, `README.md` and `LICENSE` are published (`package.json#files`) — source, tests and
> workflows never ship in the tarball. Verify locally with `npm pack --dry-run`.

## 📄 License

**Cosmos Pay Source-Available License** — see [`LICENSE`](./LICENSE).

It's based on the **Apache License 2.0** with two additional restrictions, so in short:

- ✅ **Free to use**, including in **commercial** products and services.
- ✅ **Modify and distribute** your changes under the same terms.
- ❌ **No reselling the SDK as-is** — you can't redistribute or host it substantially
  unmodified as your own product/service (Commons Clause). Building real products *on top of* it is
  fine.
- ❌ **No malicious use** — no fraud, theft, malware/phishing, or uses that break the law or
  violate others' rights.

> Because of those restrictions this is a **source-available** license, not an OSI-approved
> "open source" one. This is not legal advice.
