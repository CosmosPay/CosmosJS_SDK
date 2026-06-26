// Receive webhook events with the atomic event API — client.webhooks.on(...) plus the
// built-in HTTP handler (signature verification included).
// Run with: node examples/webhook-server.mjs  (after `npm run build`)
import { createServer } from 'node:http';
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({
  apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo',
  webhookSecret: process.env.COSMOS_WEBHOOK_SECRET ?? 'whsec_replace_me',
});

// Subscribe to events — raw type, camelCase alias, or 'event' for all.
client.webhooks.on('paymentIntentSucceeded', (event) => {
  console.log('✓ Paid!', event.data.id, event.data.amount, event.data.asset);
});

client.webhooks.on('paymentIntentFailed', (event) => {
  console.log('✗ Failed:', event.data.id);
});

client.webhooks.on('event', (event) => {
  console.log('· event:', event.type, `(${event.id})`);
});

// The handler verifies the X-Cosmos-Signature, dispatches to the listeners
// above, and replies 200 (or 400 on a bad signature).
const server = createServer(client.webhooks.createHandler());
server.listen(4242, () => console.log('Listening for webhooks on :4242'));
