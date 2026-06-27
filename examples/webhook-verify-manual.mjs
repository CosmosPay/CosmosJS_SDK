// Verifying webhook signatures yourself — the lower-level helpers, for when you
// want to handle dispatch manually (custom framework, queue, serverless, …).
// The dispatcher signs each POST with:
//   X-Cosmos-Signature: t=<unixSeconds>,v1=<hmacSha256>
// Run with: node examples/webhook-verify-manual.mjs   (after `npm run build`)
import { createHmac } from 'node:crypto';
import { Webhooks, WebhookSignatureError } from '@cosmosapp/pay_sdk';

const secret = process.env.COSMOS_WEBHOOK_SECRET ?? 'whsec_demo';

// --- Build a fake signed request so this example runs offline -------------------
const rawBody = JSON.stringify({
  id: 'evt_123',
  type: 'PAYMENT_INTENT_SUCCEEDED',
  createdAt: new Date().toISOString(),
  data: { id: 'pi_1', amount: '10', asset: 'USDC' },
});
const t = Math.floor(Date.now() / 1000);
const v1 = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
const signatureHeader = `t=${t},v1=${v1}`;
// -------------------------------------------------------------------------------

// `verify` returns true or throws WebhookSignatureError.
console.log('verify:', Webhooks.verify(rawBody, signatureHeader, secret));

// `constructEvent` verifies AND parses the JSON event in one step.
const event = Webhooks.constructEvent(rawBody, signatureHeader, secret, {
  toleranceSeconds: 300, // replay window (default 300; 0 disables)
});
console.log('event:', event.type, '→', event.data.id);

// Bad signatures throw — always wrap in try/catch at the edge.
try {
  Webhooks.constructEvent(rawBody, 't=1,v1=deadbeef', secret);
} catch (err) {
  if (err instanceof WebhookSignatureError) {
    console.log('rejected bad signature:', err.message);
  } else {
    throw err;
  }
}

// Equivalent on a configured client (also emits to your `on(...)` listeners):
//   const client = new Client({ apiKey, webhookSecret: secret });
//   client.webhooks.process(rawBody, signatureHeader);
