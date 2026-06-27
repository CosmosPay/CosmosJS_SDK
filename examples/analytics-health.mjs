// Analytics & health — read-only metrics derived from your intents/deliveries,
// plus the service liveness/readiness probes.
// Run with: node examples/analytics-health.mjs   (after `npm run build`)
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// ── Analytics ──────────────────────────────────────────────────────────────────
const summary = await client.analytics.summary();
console.log('totals:', summary.totals);            // all / succeeded / pending / successRate …
console.log('30-day volume points:', summary.volume.length);
console.log('webhook health:', summary.webhooks);

const balances = await client.analytics.balances();
console.log(`balances across ${balances.total} asset(s):`);
for (const b of balances.data) {
  console.log(`· ${b.asset}: settled=${b.amount} pending=${b.pending} (${b.count} payments)`);
}

const apiLogs = await client.analytics.apiLogs();      // recent API requests
const hookLogs = await client.analytics.webhookLogs(); // recent webhook deliveries
console.log('api log rows:', apiLogs.data?.length ?? 0);
console.log('webhook log rows:', hookLogs.data?.length ?? 0);

// ── Health (public probes — no consumer auth required) ─────────────────────────
console.log('liveness:', await client.health.liveness());     // true when up
const ready = await client.health.readiness();
console.log('readiness:', ready.status, ready.info ?? '');
