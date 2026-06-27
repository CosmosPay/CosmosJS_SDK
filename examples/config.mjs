// Configuration — every Client option, plus the shared (process-wide) defaults
// for self-hosting / staging. A normal integration only ever sets `apiKey`.
// Run with: node examples/config.mjs   (after `npm run build`)
import { Client } from '@cosmosapp/pay_sdk';

// ── Full option reference ──────────────────────────────────────────────────────
const client = new Client({
  apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo', // required — the only thing you normally set
  webhookSecret: process.env.COSMOS_WEBHOOK_SECRET,    // default secret for the webhook listener
  timeout: 30_000,                                     // per-request timeout (ms)
  retries: 2,                                          // retries for network errors / 429 / 5xx
  headers: { 'X-Trace': 'abc' },                       // extra headers on every request
  // fetch: customFetch,                               // custom fetch (e.g. a polyfill)

  // Advanced / internal — pre-filled from Client.shared, rarely overridden:
  // baseURL: 'https://api.cosmospay.lat/cosmos-api',  // gateway URL (default)
  // version: 'v1',                                    // route prefix
  // gatewaySecret: process.env.APISIX_GATEWAY_SECRET, // direct, gateway-bypassing access
  // consumerUsername: 'cosmos_demo',                  // direct access identity
});
console.log('library version:', Client.version);
console.log('resolved gateway:', client.shared.baseURL);

// ── Shared defaults (self-hosting) ─────────────────────────────────────────────
// Mutate ONCE at startup to change the gateway for every client created afterward:
//   Client.shared.baseURL = 'https://gateway.your-domain.com';

// ── Mutating an existing client ────────────────────────────────────────────────
client.setApiKey('prod_rotated_key');
client.setWebhookSecret('whsec_new_secret');
// client.setGatewayCredentials(secret, consumerUsername); // local-dev direct access
