# Configuration reference

```ts
new Client({
  apiKey: 'prod_xxx',            // required — the only thing you normally set
  webhookSecret: 'whsec_...',    // default secret for the webhook listener
  timeout: 30_000,               // ms (default 30000)
  retries: 2,                    // network errors / 429 / 5xx (default 2)
  headers: { 'X-Trace': 'abc' }, // extra headers on every request
  fetch: customFetch,            // custom fetch implementation

  // Advanced / internal — pre-filled from Client.shared, rarely overridden:
  baseURL: 'https://api.cosmospay.lat/cosmos-api', // gateway URL (default)
  version: 'v1',                 // route prefix
  gatewaySecret: '...',          // direct access (X-Gateway-Secret), local dev
  consumerUsername: '...',       // direct access (X-Consumer-Username), local dev
});
```

## Environment variables (convention)

The SDK reads nothing from the environment itself — you pass values in. Common
convention used across the docs/examples:

| Var | Used for |
| --- | -------- |
| `COSMOS_PAY_API_KEY` | `new Client({ apiKey })` |
| `COSMOS_WEBHOOK_SECRET` | `new Client({ webhookSecret })` / handler `{ secret }` |

## Self-hosting / staging

```ts
// Once at startup, for every client:
Client.shared.baseURL = 'https://gateway.your-domain.com';

// Or per-client, bypassing the gateway in local dev:
new Client({
  apiKey: 'x',
  baseURL: 'http://localhost:3000',
  gatewaySecret: process.env.APISIX_GATEWAY_SECRET,
  consumerUsername: 'cosmos_demo',
});
```
