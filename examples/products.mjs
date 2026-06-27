// Products / prices — create, list, fetch, update, (de)activate and delete.
// Run with: node examples/products.mjs   (after `npm run build`)
import { Client, ProductKind } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// ── Create ──────────────────────────────────────────────────────────────────
const product = await client.products.create({
  name: 'Pro plan — monthly',
  description: 'Everything in Starter, plus priority support.',
  amount: '49.00',            // omit for a customer-set amount
  assetCode: 'USDC',          // omit for native lumens (XLM)
  kind: ProductKind.Recurring, // 'recurring' | 'one_time' | 'link'
  reference: 'sku_pro_monthly',
});
console.log('product:', product.id, product.name, '→', product.assetLabel, product.amount);

// ── List & fetch ─────────────────────────────────────────────────────────────
const all = await client.products.list();
console.log(`you have ${all.length} product(s)`);
const fetched = await client.products.fetch(product.id);
console.log('active?', fetched.active);

// ── Update / (de)activate (atomic, self-acting structure) ──────────────────────
await product.edit({ amount: '59.00' });   // raise the price
await product.deactivate();                // hide it (active = false)
await product.activate();                  // bring it back

// ── Delete ───────────────────────────────────────────────────────────────────
// await product.delete();
