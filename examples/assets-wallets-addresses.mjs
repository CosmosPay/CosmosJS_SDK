// Typed catalogs — assets (with verified issuers), wallet ids and an address
// book, so you never paste the wrong issuer or a magic string. Plain strings
// still work everywhere. Exported from BOTH entry points.
// Run with: node examples/assets-wallets-addresses.mjs   (after `npm run build`)
import {
  Client,
  Assets,
  TestnetAssets,
  defineAsset,
  resolveAsset,
  isNativeAsset,
  Wallets,
  addresses,
  resolveAddress,
  isStellarAddress,
  isMuxedAddress,
  isContractAddress,
  isAddress,
  assertAddress,
  resolveIntentBody,
} from '@cosmosapp/pay_sdk';

const client = new Client({ apiKey: process.env.COSMOS_PAY_API_KEY ?? 'dv_demo' });

// ── Assets ────────────────────────────────────────────────────────────────────
console.log('XLM native?', isNativeAsset(Assets.XLM));        // true
console.log('USDC:', Assets.USDC.code, Assets.USDC.issuer);   // verified mainnet issuer
console.log('EURC:', Assets.EURC.code);
console.log('Testnet USDC issuer:', TestnetAssets.USDC.issuer); // network-specific!

// Define a custom asset once (issuer/contract are validated):
const AQUA = defineAsset({
  code: 'AQUA',
  issuer: 'GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA',
  name: 'Aquarius',
});
console.log('resolved AQUA:', resolveAsset(AQUA));

// ── Wallets — typed ids instead of magic strings ───────────────────────────────
console.log('wallet ids:', Wallets.FREIGHTER, Wallets.XBULL, Wallets.RABET);

// ── Address book — name accounts and reference them by name ─────────────────────
addresses.define('merchant', 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO');
console.log('resolved merchant →', resolveAddress('merchant'));

// Unknown values pass through unchanged, so raw G…/M… addresses keep working.
console.log('isStellarAddress:', isStellarAddress('GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO'));
console.log('isMuxedAddress:', isMuxedAddress('MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAAAJLK'));
console.log('isContractAddress:', isContractAddress('CA...'.padEnd(56, 'A')));
console.log('isAddress:', isAddress('merchant'));
try {
  assertAddress('not-an-address'); // throws on an invalid value
} catch (err) {
  console.log('assertAddress rejected:', err.message);
}

// ── Putting it together — typed asset + named destination ──────────────────────
const intent = await client.paymentIntents.createPay({
  destination: 'merchant', // resolved from the address book
  amount: '5',
  asset: AQUA,             // resolved to assetCode + assetIssuer
});
console.log('created with typed catalogs:', intent.id);

// `resolveIntentBody` is what the managers call under the hood — handy for
// inspecting the exact body that will be sent.
console.log(
  'resolved body:',
  resolveIntentBody({ destination: 'merchant', amount: '5', asset: Assets.USDC }),
);
