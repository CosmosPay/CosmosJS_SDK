# Examples

Runnable examples covering **every** part of `@cosmosapp/pay_sdk`. They import the
package by name (`@cosmosapp/pay_sdk` / `@cosmosapp/pay_sdk/web`) via Node's
package self-reference, so build the SDK first:

```bash
npm run build
```

Then run any file (most read `COSMOS_PAY_API_KEY` / `COSMOS_WEBHOOK_SECRET` from
the environment and fall back to a demo value):

```bash
COSMOS_PAY_API_KEY=dv_xxx node examples/quickstart.mjs
```

> Looking for AI-assistant–ready docs? See the isolated [`../llms/`](../llms) folder
> (`llms.txt` + atomic per-topic files) — drop it into your tool's context to make
> integrating the SDK much easier.

## Server SDK (`@cosmosapp/pay_sdk`)

| File | What it shows |
| ---- | ------------- |
| [`quickstart.mjs`](./quickstart.mjs) | Smallest end-to-end flow: create → URI/QR → validate |
| [`basic.mjs`](./basic.mjs) | Create a `pay` intent, list, validate |
| [`payment-intents.mjs`](./payment-intents.mjs) | Full lifecycle: `createTx`/`createPay`, fetch, list, edit, cancel, delete, validate, structure helpers |
| [`assets-wallets-addresses.mjs`](./assets-wallets-addresses.mjs) | Typed catalogs: `Assets`, `TestnetAssets`, `defineAsset`, `Wallets`, the address book, validators |
| [`products.mjs`](./products.mjs) | Products / prices CRUD + (de)activate |
| [`customers.mjs`](./customers.mjs) | Customers CRUD + payment stats |
| [`analytics-health.mjs`](./analytics-health.mjs) | `summary`, `balances`, `apiLogs`, `webhookLogs`, health probes |
| [`error-handling.mjs`](./error-handling.mjs) | `CosmosPayAPIError` vs `CosmosPayRequestError`, retries |
| [`observability.mjs`](./observability.mjs) | `client.on('request'|'response'|'rateLimited'|'debug')` |
| [`config.mjs`](./config.mjs) | Every `ClientOptions` field + shared/self-host config |
| [`typescript.ts`](./typescript.ts) | Fully-typed usage (compile with `tsc`, or `tsx`) |

## Webhooks

| File | What it shows |
| ---- | ------------- |
| [`webhooks-endpoints.mjs`](./webhooks-endpoints.mjs) | Register/manage endpoints, rotate secret, delivery audit trail, redeliver |
| [`webhook-server.mjs`](./webhook-server.mjs) | Receive events with the built-in Node `http` handler |
| [`webhook-express.mjs`](./webhook-express.mjs) | Receive events with the Express middleware |
| [`webhook-verify-manual.mjs`](./webhook-verify-manual.mjs) | Verify/parse signatures yourself (`Webhooks.verify` / `constructEvent`) |

## Browser web client (`@cosmosapp/pay_sdk/web`)

| File | What it shows |
| ---- | ------------- |
| [`web-client.mjs`](./web-client.mjs) | Complete an intent in one call with the user's wallet |
| [`web-client-advanced.mjs`](./web-client-advanced.mjs) | Inspect/choose wallets, build-before-sign, sign-only, custom adapters, DI, direct API |
