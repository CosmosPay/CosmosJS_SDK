// Customers — create, list (with payment stats), fetch, update and delete.
// Run with: node examples/customers.mjs   (after `npm run build`)
import { Client } from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// ── Create ──────────────────────────────────────────────────────────────────
const customer = await client.customers.create({
  name: 'Acme Inc.',
  email: 'billing@acme.com',
  alias: 'acme',
  account: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO', // optional Stellar account
  reference: 'crm_4821',
});
console.log('customer:', customer.id, customer.name);

// ── Update (atomic, self-acting structure) ─────────────────────────────────────
await customer.edit({ note: 'VIP, net-30' });

// ── Fetch ─────────────────────────────────────────────────────────────────────
const fetched = await client.customers.fetch(customer.id);
console.log('email:', fetched.email, '· note:', fetched.note);

// ── List — includes payment stats (payments / succeeded / total) ───────────────
const customers = await client.customers.list();
for (const c of customers) {
  console.log(
    `· ${c.name}  payments=${c.payments ?? 0}  succeeded=${c.succeeded ?? 0}  total=${c.total ?? '0'}`,
  );
}

// ── Delete ───────────────────────────────────────────────────────────────────
// await customer.delete();
