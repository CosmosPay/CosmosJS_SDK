<div align="center">

# 🪐 cosmospay.js

**The object-oriented JavaScript / TypeScript SDK for the [Cosmos Pay](#) Payments API**

Stellar **SEP-7 payment intents** · **webhooks** · **products** · **customers** · **analytics**

[![npm version](https://img.shields.io/npm/v/cosmospay.js.svg?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/cosmospay.js)
[![npm downloads](https://img.shields.io/npm/dm/cosmospay.js.svg?style=flat-square&color=7c3aed)](https://www.npmjs.com/package/cosmospay.js)
[![types](https://img.shields.io/npm/types/cosmospay.js.svg?style=flat-square&color=3178c6)](https://www.npmjs.com/package/cosmospay.js)
[![node](https://img.shields.io/node/v/cosmospay.js.svg?style=flat-square&color=339933)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/cosmospay.js.svg?style=flat-square&color=22c55e)](./LICENSE)

</div>

---

Designed in the style of **discord.js**: one atomic `Client`, every resource split into its own
manager, and rich structure classes that can act on themselves.

```ts
import { Client } from 'cosmospay.js';

// You only bring your API key — the gateway URL and other internals are pre-configured for you.
const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });

const intent = await client.paymentIntents.createPay({ destination: 'G...', amount: '10' });
console.log(intent.uri); // web+stellar:pay?destination=...
```

## ✨ Features

- ✅ **TypeScript & JavaScript** — full typings, works in both **CJS** and **ESM**.
- ✅ **Zero runtime dependencies** — native `fetch` + `node:crypto`, nothing else.
- ✅ **Atomic, discord.js-style API** — `client.paymentIntents`, `client.webhooks`, …
- ✅ **Self-acting structures** — `intent.validate()`, `endpoint.rotateSecret()`, `product.deactivate()`.
- ✅ **Built-in webhook signature verification** + ready-made `http` / Express handlers.
- ✅ **Resilient by default** — automatic retries, timeouts and structured errors.

## 📑 Table of contents

- [Installation](#-installation)
- [Authentication](#-authentication)
- [Quick start](#-quick-start)
- [The client at a glance](#-the-client-at-a-glance)
- [Payment intents](#-payment-intents)
- [Webhooks](#-webhooks)
- [Products & customers](#-products--customers)
- [Analytics & health](#-analytics--health)
- [Error handling](#-error-handling)
- [Observability](#-observability)
- [Configuration reference](#-configuration-reference)
- [TypeScript](#-typescript)
- [Running the tests locally](#-running-the-tests-locally)
- [License](#-license)

## 📦 Installation

```bash
npm install cosmospay.js
# or
pnpm add cosmospay.js
# or
yarn add cosmospay.js
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
import { Client } from 'cosmospay.js';

Client.shared.baseURL = 'https://staging.cosmospay.io';
// every client created afterwards inherits this
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
import { Client } from 'cosmospay.js';

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

// pay intent (no source)
const pay = await client.paymentIntents.createPay({ destination: 'G...', amount: '10' });

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

Subscribe to events the discord.js way. You can listen with the raw type, its camelCase alias, or
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
import { Webhooks } from 'cosmospay.js';

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
import { CosmosPayAPIError, CosmosPayRequestError } from 'cosmospay.js';

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
  baseURL: 'https://...',        // gateway URL
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
} from 'cosmospay.js';
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

## 📄 License

[MIT](./LICENSE)
