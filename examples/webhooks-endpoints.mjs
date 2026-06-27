// Webhook endpoints — register and manage where Cosmos Pay POSTs events, and
// inspect the delivery audit trail. (To RECEIVE events, see webhook-server.mjs.)
// Run with: node examples/webhooks-endpoints.mjs   (after `npm run build`)
import { Client, WebhookEventType } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// ── Register an endpoint — the signing secret is returned ONCE ──────────────────
const endpoint = await client.webhooks.create({
  url: 'https://me.example.com/hooks/cosmos',
  description: 'Production payment events',
  eventTypes: [
    WebhookEventType.PaymentIntentSucceeded,
    WebhookEventType.PaymentIntentFailed,
  ], // omit/empty → receive ALL event types
});
console.log('endpoint:', endpoint.id);
console.log('secret (store it now!):', endpoint.secret); // whsec_… — only here
console.log('receives all events?', endpoint.receivesAllEvents);

// ── List & fetch ───────────────────────────────────────────────────────────────
const all = await client.webhooks.list();
console.log(`you have ${all.length} endpoint(s)`);
const again = await client.webhooks.fetch(endpoint.id);
console.log('fetched:', again.id, again.enabled ? 'enabled' : 'disabled');

// ── Manage it (atomic, self-acting structure) ──────────────────────────────────
await endpoint.disable();              // pause deliveries
await endpoint.enable();               // resume
await endpoint.edit({ description: 'Renamed endpoint' });
const ping = await endpoint.ping();    // send a test event
console.log('ping:', ping);

// Rotate the secret (returns a NEW instance carrying the new secret).
const rotated = await endpoint.rotateSecret();
console.log('new secret:', rotated.secret);

// ── Delivery audit trail + manual redelivery ───────────────────────────────────
const deliveries = await endpoint.fetchDeliveries({ status: 'FAILED', take: 50 });
console.log(`failed deliveries: ${deliveries.items.length} of ${deliveries.total}`);
for (const d of deliveries.items) {
  await d.redeliver(); // re-send a past delivery
}

// ── Clean up ───────────────────────────────────────────────────────────────────
// await endpoint.delete();
