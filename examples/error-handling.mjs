// Error handling — distinguish API errors (the server replied with 4xx/5xx) from
// request errors (network/timeout), and tune the automatic retry behavior.
// Run with: node examples/error-handling.mjs   (after `npm run build`)
import {
  Client,
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '@cosmosapp/pay_sdk';

// Transient failures (network errors, 408, 429, 5xx) are retried automatically.
// Defaults: retries = 2 (honoring Retry-After), timeout = 30_000 ms.
const client = new Client({
  apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo',
  timeout: 10_000,
  retries: 3,
});

try {
  await client.paymentIntents.fetch('pi_does_not_exist');
} catch (err) {
  if (err instanceof CosmosPayAPIError) {
    // The server responded with an error status.
    console.error('API error:', err.status, err.code);
    console.error('body:', err.body);
  } else if (err instanceof CosmosPayRequestError) {
    // The request never got a usable response (DNS, TLS, timeout, offline…).
    console.error('Request error:', err.message);
    console.error('cause:', err.cause);
  } else {
    throw err; // something unexpected — don't swallow it
  }
}
