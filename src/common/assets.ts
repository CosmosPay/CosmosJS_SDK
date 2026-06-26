/**
 * A typed, extensible catalog of Stellar assets.
 *
 * Instead of hunting down an asset's issuer (or pasting the wrong one), use the
 * built-in catalog — `Assets.USDC`, `Assets.EURC`, `Assets.XLM` — which carries
 * the verified issuer for you. Need something else? `defineAsset(...)` makes a
 * typed asset you can reuse. And a plain code string still works everywhere.
 *
 * ⚠️ Issuers are network-specific. The {@link Assets} catalog targets **mainnet**;
 * {@link TestnetAssets} carries the testnet issuers. Bare code strings (e.g.
 * `'USDC'`) are treated as *code only* (no issuer) for backwards compatibility —
 * use the catalog object or `defineAsset` when you want the issuer filled in.
 */

import { isStellarAddress } from '@/common/addresses';

/** A fully-described Stellar asset. */
export interface AssetDefinition {
  /** Asset code, e.g. `USDC`. Use `XLM` (or omit the issuer) for native lumens. */
  code: string;
  /** Issuer account (`G…`). `null`/omitted means the native asset (XLM). */
  issuer?: string | null;
  /** Optional Soroban contract id (`C…`) for the SAC / token contract. */
  contract?: string;
  /** Human-readable name. */
  name?: string;
  /** Network the `issuer` is valid on. */
  network?: 'public' | 'testnet';
}

/** Anything accepted where an asset is expected: a code string or a definition. */
export type AssetRef = string | AssetDefinition;

/** Normalized asset: a code plus a concrete issuer (or `null` for native). */
export interface ResolvedAsset {
  /** `XLM` for the native asset, otherwise the asset code. */
  code: string;
  /** Issuer `G…`, or `null` for the native asset. */
  issuer: string | null;
  /** Optional Soroban contract id. */
  contract?: string;
}

const NATIVE: AssetDefinition = { code: 'XLM', issuer: null, name: 'Stellar Lumens' };

/**
 * Built-in **mainnet** assets with verified issuers. Extend with your own via
 * {@link defineAsset}. Issuers sourced from the official issuers (Circle for
 * USDC/EURC).
 */
export const Assets = {
  /** Native lumens. */
  XLM: NATIVE,
  /** USD Coin by Circle (mainnet). */
  USDC: {
    code: 'USDC',
    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    name: 'USD Coin',
    network: 'public',
  },
  /** Euro Coin by Circle (mainnet). */
  EURC: {
    code: 'EURC',
    issuer: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2',
    name: 'Euro Coin',
    network: 'public',
  },
} as const satisfies Record<string, AssetDefinition>;

/** Built-in **testnet** assets (Circle's Test SDF Network issuers). */
export const TestnetAssets = {
  XLM: NATIVE,
  USDC: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    name: 'USD Coin',
    network: 'testnet',
  },
  EURC: {
    code: 'EURC',
    issuer: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
    name: 'Euro Coin',
    network: 'testnet',
  },
} as const satisfies Record<string, AssetDefinition>;

/** Whether a reference denotes the native asset (XLM). */
export function isNativeAsset(ref: AssetRef): boolean {
  if (typeof ref === 'string') {
    const code = ref.trim().toLowerCase();
    return code === '' || code === 'xlm' || code === 'native';
  }
  return !ref.issuer || isNativeAsset(ref.code);
}

/**
 * Create a reusable, typed custom asset. Validates the issuer/contract format so
 * a typo surfaces immediately rather than on-chain.
 *
 * @example
 * const AQUA = defineAsset({ code: 'AQUA', issuer: 'GBNZ...', name: 'Aquarius' });
 * await client.paymentIntents.createPay({ destination, amount: '5', asset: AQUA });
 */
export function defineAsset(def: AssetDefinition): AssetDefinition {
  if (!def.code) throw new TypeError('defineAsset requires a `code`.');
  if (def.issuer != null && !isStellarAddress(def.issuer)) {
    throw new TypeError(`defineAsset: invalid issuer for ${def.code}: ${def.issuer}`);
  }
  if (def.contract != null && !/^C[A-Z2-7]{55}$/.test(def.contract)) {
    throw new TypeError(`defineAsset: invalid contract for ${def.code}: ${def.contract}`);
  }
  return Object.freeze({ ...def });
}

/**
 * Normalize an {@link AssetRef} into `{ code, issuer, contract }`.
 *
 * - A bare string is treated as *code only* (`issuer: null`) — pass a catalog
 *   object or `defineAsset(...)` result when you want the issuer included.
 * - The native asset normalizes to `{ code: 'XLM', issuer: null }`.
 */
export function resolveAsset(ref: AssetRef): ResolvedAsset {
  if (isNativeAsset(ref)) return { code: 'XLM', issuer: null };
  if (typeof ref === 'string') return { code: ref, issuer: null };
  return {
    code: ref.code,
    issuer: ref.issuer ?? null,
    ...(ref.contract ? { contract: ref.contract } : {}),
  };
}
