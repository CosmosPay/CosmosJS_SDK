# Error handling & observability

## Errors

```ts
import { CosmosPayAPIError, CosmosPayRequestError } from '@cosmosapp/pay_sdk';

try {
  await client.paymentIntents.fetch('missing');
} catch (err) {
  if (err instanceof CosmosPayAPIError) {
    // server responded with an error status
    console.error(err.status, err.code, err.body); // e.g. 404
  } else if (err instanceof CosmosPayRequestError) {
    // no usable response — network / TLS / timeout / offline
    console.error('Network/timeout:', err.cause);
  } else {
    throw err;
  }
}
```

- `CosmosPayAPIError` — the API replied with 4xx/5xx. Fields: `status`, `code`, `body`.
- `CosmosPayRequestError` — the request never completed. Field: `cause`.
- Web client adds: `CosmosPayWebError`, `WalletNotFoundError`, `WalletError`
  (user rejected / locked), `StellarSdkRequiredError`, `IntentError`. The API
  error classes are re-exported from `/web` too, so `catch` works across entries.
- Webhook signature failures throw `WebhookSignatureError`.

### Retries

Transient failures (network errors, `408`, `429`, `5xx`) are retried
automatically — default **2** retries, honoring `Retry-After`. Tune via
`new Client({ retries, timeout })`.

## Observability

The client re-emits REST telemetry:

```ts
client.on('request',     ({ method, url, attempt }) => {});
client.on('response',    ({ method, url, status, attempt }) => {});
client.on('rateLimited', ({ method, url, attempt }) => {});
client.on('debug',       (message) => {});
```

Wire these into your logger/APM to trace or meter every request.
