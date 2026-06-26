/**
 * Stellar network resolution.
 *
 * The web client has to figure out *which* network a payment targets (to pick
 * the right passphrase, Horizon endpoint and wallet network label) without the
 * integrator having to spell it out. It derives that from whatever the intent
 * carries — a passphrase, a `PUBLIC`/`TESTNET` label, or a SEP-7
 * `network_passphrase` — and falls back to public mainnet.
 */

import type { NetworkConfig, StellarNetwork } from '@/web/types';

/** Canonical network passphrases. */
export const PASSPHRASES = {
  public: 'Public Global Stellar Network ; September 2015',
  testnet: 'Test SDF Network ; September 2015',
} as const satisfies Record<StellarNetwork, string>;

/** Default Horizon endpoints maintained by SDF. */
export const HORIZON_URLS = {
  public: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
} as const satisfies Record<StellarNetwork, string>;

/** Wallet-facing network labels (Rabet/Albedo use `mainnet`/`public`). */
export const RABET_NETWORK = {
  public: 'mainnet',
  testnet: 'testnet',
} as const satisfies Record<StellarNetwork, string>;

/**
 * Best-effort classification of a free-form network hint into `public` /
 * `testnet`. Accepts a passphrase, a label (`PUBLIC`, `mainnet`, `pubnet`…), or
 * `null`. Defaults to `public`.
 */
export function classifyNetwork(hint: string | null | undefined): StellarNetwork {
  if (!hint) return 'public';
  const value = hint.trim().toLowerCase();
  if (value === PASSPHRASES.testnet.toLowerCase()) return 'testnet';
  if (value === PASSPHRASES.public.toLowerCase()) return 'public';
  if (value.includes('test')) return 'testnet';
  if (value.includes('public') || value.includes('main') || value.includes('pubnet')) {
    return 'public';
  }
  return 'public';
}

/** Whether a string is a known full Stellar network passphrase. */
export function isPassphrase(value: string | null | undefined): boolean {
  return value === PASSPHRASES.public || value === PASSPHRASES.testnet;
}

/** Inputs that influence which {@link NetworkConfig} the client resolves to. */
export interface ResolveNetworkInput {
  /** Network hint from the intent (`network` field or SEP-7 passphrase). */
  hint?: string | null;
  /** Explicit override from the client options. */
  network?: StellarNetwork;
  /** Explicit passphrase override. */
  passphrase?: string;
  /** Explicit Horizon URL override. */
  horizonUrl?: string;
}

/**
 * Resolve a complete {@link NetworkConfig}. Explicit overrides win; otherwise we
 * infer the network from the intent hint and fill in the canonical passphrase
 * and Horizon endpoint.
 */
export function resolveNetwork(input: ResolveNetworkInput = {}): NetworkConfig {
  const network =
    input.network ??
    classifyNetwork(input.passphrase ?? input.hint);
  return {
    network,
    passphrase: input.passphrase ?? PASSPHRASES[network],
    horizonUrl: (input.horizonUrl ?? HORIZON_URLS[network]).replace(/\/+$/, ''),
  };
}
