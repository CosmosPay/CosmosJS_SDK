// Quickstart — the smallest end-to-end flow: create an intent, show the pay URI
// + QR, then validate a submitted transaction.
// Run with: node examples/quickstart.mjs   (after `npm run build`)
import { Client, Assets } from '@cosmosapp/pay_sdk';

// You only bring your API key — the gateway URL and other internals are
// pre-configured for you. `dv_` keys hit testnet, `prod_` keys hit mainnet.
const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// 1. Create a SEP-7 `pay` intent (no source → the payer's wallet picks the source).
//    `Assets.USDC` fills the verified mainnet issuer for you.
const intent = await client.paymentIntents.createPay({
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '10',
  asset: Assets.USDC,
  msg: 'Order #1001',
});

// 2. Hand these to your frontend: `uri` is the `web+stellar:pay?...` deep link,
//    `qr` is a ready-to-render PNG data URL.
console.log('Intent id:', intent.id);
console.log('Pay URI: ', intent.uri);
console.log('QR data URL bytes:', intent.qr.length);

// 3. After the payer submits, finalize by validating the transaction hash.
//    (Uncomment once you have a real txHash from the browser web client.)
// const outcome = await intent.validate('<txHash>');
// console.log('Valid?', outcome.valid, '→', outcome.status);
