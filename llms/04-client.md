# The Client

```ts
import { Client } from '@cosmosapp/pay_sdk';
const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });
```

One client exposes every resource through its own manager.

| Manager | Resource | Key methods |
| ------- | -------- | ----------- |
| `client.paymentIntents` | Stellar SEP-7 intents | `createTx` · `createPay` · `fetch` · `list` · `update` · `delete` · `validate` |
| `client.webhooks` | Endpoints + deliveries + event listener | `create` · `list` · `fetch` · `update` · `delete` · `rotateSecret` · `ping` · `fetchDeliveries` · `redeliver` · `on(...)` · `process` · `createHandler` · `middleware` |
| `client.products` | Products / prices | `create` · `list` · `fetch` · `update` · `delete` |
| `client.customers` | Customers | `create` · `list` · `fetch` · `update` · `delete` |
| `client.analytics` | Read-only metrics | `summary` · `balances` · `apiLogs` · `webhookLogs` |
| `client.health` | Liveness / readiness | `liveness` · `readiness` |

## Constructor options

```ts
new Client({
  apiKey: 'prod_xxx',          // required — the only thing you normally set
  webhookSecret: 'whsec_...',  // default secret for the webhook listener
  timeout: 30_000,             // ms (default 30000)
  retries: 2,                  // network errors / 429 / 5xx (default 2)
  headers: { 'X-Trace': 'abc' },
  fetch: customFetch,          // custom fetch implementation

  // Advanced / internal (pre-filled from Client.shared, rarely set):
  baseURL: 'https://api.cosmospay.lat/cosmos-api',
  version: 'v1',
  gatewaySecret: '...',
  consumerUsername: '...',
});
```

## Statics & mutators

```ts
Client.version;                         // library version string
Client.shared.baseURL = 'https://...';  // process-wide default for all clients

client.setApiKey('prod_rotated');
client.setWebhookSecret('whsec_new');
client.setGatewayCredentials(secret, consumerUsername); // local-dev direct access
```

## Returned objects are "structures"

Manager methods return rich instances (`PaymentIntent`, `WebhookEndpoint`,
`Product`, `Customer`) that can act on themselves and expose typed accessors —
e.g. `intent.isPay`, `intent.assetLabel`, `await intent.validate(txHash)`,
`await endpoint.disable()`. Call `.toJSON()` for the raw payload.
