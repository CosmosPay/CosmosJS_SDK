// Payment intents — the full lifecycle: createTx / createPay, fetch, list,
// edit, cancel, delete, validate, plus the typed structure helpers.
// Run with: node examples/payment-intents.mjs   (after `npm run build`)
import { Client, Assets, PaymentIntentStatus } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// ── tx intent (source known → unsigned XDR + tx URI + QR) ──────────────────────
const tx = await client.paymentIntents.createTx({
  source: 'GA3K7X9PLQ7YQ2H5K6F3WYV4Z2N5R6T7U8V9W0X1Y2Z3A4B5C6D7E8F',
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '25.5',
  // memo: '123456789',   // optional MEMO_ID — auto-generated when omitted
});
console.log('tx intent:', tx.id, '\n  xdr?', Boolean(tx.xdr), '\n  uri:', tx.uri);

// ── pay intent (no source) ─────────────────────────────────────────────────────
// Three equivalent ways to set the asset:
//   a) typed catalog (fills the verified issuer):        asset: Assets.USDC
//   b) explicit code + issuer:                           assetCode + assetIssuer
//   c) omit the asset entirely for native lumens (XLM)
const pay = await client.paymentIntents.createPay({
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  amount: '120.1234567',
  asset: Assets.USDC,
  msg: 'Order #24',
});
console.log('pay intent:', pay.id, '→', pay.assetLabel);

// Open-amount intent (donations / tips): omit `amount`, the wallet asks for it.
const donation = await client.paymentIntents.createPay({
  destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  msg: 'Tip jar ☕',
});
console.log('open-amount intent:', donation.id, 'amount =', donation.amount);

// ── fetch one ───────────────────────────────────────────────────────────────
const fetched = await client.paymentIntents.fetch(pay.id);
console.log('fetched:', fetched.id, fetched.status);

// ── list (paginated + filtered) ───────────────────────────────────────────────
const page = await client.paymentIntents.list({
  status: PaymentIntentStatus.Pending, // optional filter
  take: 20, // page size (max 100)
  skip: 0,
});
console.log(`page: ${page.items.length} of ${page.total} (take=${page.take} skip=${page.skip})`);

// ── typed structure helpers ───────────────────────────────────────────────────
for (const it of page.items) {
  console.log(
    `· ${it.id}  ${it.isPay ? 'PAY' : 'TX'}  ${it.assetLabel}  ` +
      `${it.isSucceeded ? 'settled' : it.isPending ? 'pending' : it.status}`,
  );
}

// ── update / cancel / delete (atomic, self-acting structures) ──────────────────
await pay.edit({ reference: 'order_1234' }); // mutates `pay` in place
// await pay.cancel();                        // → status CANCELLED
// await pay.delete();                        // remove it

// ── validate a submitted transaction (finalizes status + fires the webhook) ────
// const outcome = await pay.validate('<txHash>');
// if (outcome.valid) console.log('Settled!', outcome.status);
// else console.log('Not valid:', outcome.reason);
