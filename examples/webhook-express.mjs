// Receiving webhooks with Express — the built-in middleware verifies the
// signature, dispatches to your `on(...)` listeners, and attaches the parsed
// event to `req.cosmosEvent`.
// Run with: node examples/webhook-express.mjs   (after `npm run build` and
//           `npm install express`)
import express from 'express';
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({
  apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo',
  webhookSecret: process.env.COSMOS_WEBHOOK_SECRET ?? 'whsec_replace_me',
});

// Subscribe to events (raw type, camelCase alias, or 'event' for all).
client.webhooks.on('paymentIntentSucceeded', (event) => {
  console.log('✓ Paid!', event.data.id, event.data.amount, event.data.asset);
});
client.webhooks.on('event', (event) => {
  console.log('· event:', event.type, `(${event.id})`);
});

const app = express();

// IMPORTANT: the middleware needs the RAW body so the HMAC signature matches.
// Mount express.raw BEFORE the middleware on the webhook route.
app.post(
  '/hooks/cosmos',
  express.raw({ type: '*/*' }),
  client.webhooks.middleware(), // pass { secret } here to override the client's
  (req, res) => {
    // Listeners have already fired; req.cosmosEvent is the verified event.
    console.log('handled', req.cosmosEvent.type);
    res.sendStatus(200);
  },
);

app.listen(4242, () => console.log('Express webhook server on :4242'));
