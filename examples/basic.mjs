// Basic usage — create a payment intent, list and validate.
// Run with: node examples/basic.mjs  (after `npm run build`)
import { Client } from '@cosmosapp/pay_sdk';

// You only provide your API key — the gateway is handled for you.
const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY });

// For local dev against a self-hosted service you can override the gateway:
// const client = new Client({
//   apiKey: 'x',
//   baseURL: 'http://localhost:3000',
//   gatewaySecret: process.env.APISIX_GATEWAY_SECRET,
//   consumerUsername: 'cosmos_demo',
// });

client.on('response', ({ method, url, status }) =>
  console.log(`← ${status} ${method} ${url}`),
);

// 1. Create a SEP-7 `pay` intent (no source → URI + QR only).
const intent = await client.paymentIntents.createPay({
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '12.5',
  msg: 'Coffee ☕',
});
console.log('Created intent:', intent.id);
console.log('Pay URI:', intent.uri);
console.log('QR (data URL length):', intent.qr.length);

// 2. List recent intents.
const page = await client.paymentIntents.list({ take: 5 });
console.log(`You have ${page.total} intents; showing ${page.items.length}.`);

// 3. Validate once the payer has submitted a transaction.
// const outcome = await intent.validate('<txHash>');
// console.log('Valid?', outcome.valid, outcome.status);
