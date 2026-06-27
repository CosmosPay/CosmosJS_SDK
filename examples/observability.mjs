// Observability — the client re-emits REST telemetry so you can log, trace or
// meter every request. Great for wiring into your own logger/APM.
// Run with: node examples/observability.mjs   (after `npm run build`)
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

client.on('request', ({ method, url, attempt }) =>
  console.log(`→ ${method} ${url}${attempt > 1 ? ` (retry ${attempt})` : ''}`),
);
client.on('response', ({ method, url, status }) =>
  console.log(`← ${status} ${method} ${url}`),
);
client.on('rateLimited', ({ method, url }) =>
  console.warn(`⏳ rate limited: ${method} ${url}`),
);
client.on('debug', (message) => console.debug('debug:', message));

// Any call now narrates itself through the listeners above.
await client.paymentIntents.list({ take: 1 }).catch(() => {});
