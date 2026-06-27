# Authentication

**You only need your API key.** Everything else (gateway URL, API version) is
part of the SDK's shared configuration, maintained by Cosmos Pay.

```ts
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });
```

The API key is sent as `Authorization: Bearer <apiKey>`.

## Network selection (important)

The **network is determined by the key type** — you do NOT configure it:

| Key prefix | Network |
| ---------- | ------- |
| `dv_…`     | testnet |
| `prod_…`   | mainnet |

Because of this, asset issuers are network-specific: use `Assets.*` for mainnet
and `TestnetAssets.*` for testnet (see assets docs).

## Keep the key on the server

The API key is a secret. Create and validate intents on your **server**. The
browser web client only signs/submits; it does not need the key. (It *can* take
an `apiKey` for trusted prototypes, but never ship a production key to the browser.)

## Shared / self-hosting overrides (advanced)

```ts
// Change the gateway for every client created afterward (once, at startup):
Client.shared.baseURL = 'https://gateway.your-domain.com';

// Or per-client (rarely needed) — e.g. local dev bypassing the gateway:
const client = new Client({
  apiKey: '...',
  baseURL: 'http://localhost:3000',
  gatewaySecret: process.env.APISIX_GATEWAY_SECRET,
  consumerUsername: 'cosmos_demo',
});
```

`baseURL`, `version`, `gatewaySecret`, `consumerUsername` are all optional — a
normal integration never sets them.
