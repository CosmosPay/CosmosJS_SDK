/**
 * Shared resolution of "create intent" input, used by both the server SDK and
 * the web client so the convenience layers behave identically: a typed
 * {@link AssetRef} (e.g. `Assets.USDC`) is expanded into `assetCode`/`assetIssuer`,
 * and named addresses are substituted via an {@link AddressBook}.
 */

import { addresses as defaultBook, AddressBook, resolveAddress } from '@/common/addresses';
import { resolveAsset, type AssetRef } from '@/common/assets';

/** Fields the resolver understands (everything else passes through untouched). */
export interface ResolvableIntentInput {
  destination?: string;
  source?: string;
  /** Typed asset (`Assets.USDC`, `defineAsset(...)`) — fills code + issuer. */
  asset?: AssetRef;
  assetCode?: string;
  assetIssuer?: string;
}

/**
 * Expand `asset` into `assetCode`/`assetIssuer` and resolve named
 * `destination`/`source` addresses. Existing `assetCode`/`assetIssuer` win over a
 * provided `asset`; native assets leave the code unset (the API treats an omitted
 * asset as native XLM). Returns a new object — the input is not mutated.
 */
export function resolveIntentBody<T extends ResolvableIntentInput>(
  options: T,
  book: AddressBook = defaultBook,
): Omit<T, 'asset'> {
  const out: Record<string, unknown> = { ...(options as Record<string, unknown>) };

  if (typeof out['destination'] === 'string') {
    out['destination'] = resolveAddress(out['destination'], book);
  }
  if (typeof out['source'] === 'string') {
    out['source'] = resolveAddress(out['source'], book);
  }

  if (out['asset'] != null) {
    const { code, issuer } = resolveAsset(out['asset'] as AssetRef);
    delete out['asset'];
    if (issuer) {
      // Non-native: fill code + issuer unless the caller set them explicitly.
      out['assetCode'] ??= code;
      out['assetIssuer'] ??= issuer;
    }
    // Native (issuer == null) → leave assetCode/assetIssuer omitted = native XLM.
  }

  return out as Omit<T, 'asset'>;
}
