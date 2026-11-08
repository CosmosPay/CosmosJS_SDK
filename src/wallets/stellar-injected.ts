/**
 * Stellar wallets that inject a provider into the page and need no library: Hana, Klever, OneKey,
 * Bitget, Cactus Link, D'CENT and Scopuly. Each is reached the way the wallet documents (and the
 * Stellar Wallets Kit's own modules do), so an app gets them without depending on the kit.
 */

import { WalletError } from '@/web/errors';
import { errorMessage } from '@/web/adapters/util';
import { PASSPHRASES } from '@/web/network';
import type { StellarWallet, WalletWindow } from '@/wallets/types';

type Provider = Record<string, (...args: unknown[]) => Promise<unknown>>;

interface InjectedStellarSpec {
  id: string;
  name: string;
  provider(win: Record<string, any>): Provider | undefined;
  address(provider: Provider): Promise<unknown>;
  sign(provider: Provider, xdr: string, opts: { networkPassphrase: string; address?: string }): Promise<unknown>;
}

/** A wallet's `{ error }` answer, thrown. */
function check(result: unknown): unknown {
  if (result && typeof result === 'object' && (result as { error?: unknown }).error) {
    const error = (result as { error: unknown }).error;
    throw new Error(typeof error === 'string' ? error : errorMessage(error));
  }
  return result;
}

/** The string a wallet answered, bare or under one of `keys`. */
function pick(result: unknown, keys: string[]): string {
  check(result);
  if (typeof result === 'string' && result) return result;
  if (result && typeof result === 'object') {
    for (const key of keys) {
      const value = (result as Record<string, unknown>)[key];
      if (typeof value === 'string' && value) return value;
    }
  }
  throw new Error('The wallet answered nothing usable.');
}

const positional = (p: Provider, xdr: string, opts: { networkPassphrase: string; address?: string }) =>
  p['signTransaction']!(xdr, opts);

/** Ask for access first where the wallet has the step (Freighter's API shape). */
async function withAccess(p: Provider, strict: boolean): Promise<unknown> {
  if (typeof p['requestAccess'] === 'function') {
    try {
      check(await p['requestAccess']());
    } catch (error) {
      if (strict) throw error;
    }
  }
  return typeof p['getAddress'] === 'function' ? p['getAddress']() : p['getPublicKey']!();
}

export const INJECTED_STELLAR_WALLETS: readonly InjectedStellarSpec[] = [
  {
    id: 'hana',
    name: 'Hana Wallet',
    provider: (w) => w['hanaWallet']?.stellar,
    address: (p) => p['getPublicKey']!(),
    sign: (p, xdr, o) =>
      p['signTransaction']!({ xdr, accountToSign: o.address, networkPassphrase: o.networkPassphrase }),
  },
  {
    id: 'klever',
    name: 'Klever Wallet',
    provider: (w) => w['kleverWallet']?.stellar,
    address: (p) => p['getAddress']!(),
    sign: positional,
  },
  {
    id: 'onekey',
    name: 'OneKey Wallet',
    provider: (w) => w['$onekey']?.stellar,
    address: (p) => p['getPublicKey']!(),
    sign: positional,
  },
  {
    id: 'bitget',
    name: 'Bitget Wallet',
    provider: (w) => w['bitkeep']?.stellar,
    address: (p) => p['connect']!(),
    sign: positional,
  },
  {
    id: 'cactuslink',
    name: 'Cactus Link',
    provider: (w) => w['cactuslink_stellar'],
    address: (p) => withAccess(p, true),
    sign: positional,
  },
  {
    id: 'dcent',
    name: "D'CENT Wallet",
    // The extension and the in-app browser both mark themselves on `window.stellar`.
    provider: (w) => (w['stellar']?.provider === 'dcent' ? w['dcentStellarProvider'] : undefined),
    // Its in-app browser has no access step and exposes the account directly.
    address: (p) => withAccess(p, false),
    sign: positional,
  },
  {
    id: 'scopuly',
    name: 'Scopuly',
    provider: (w) => (w['scopuly']?.isScopuly === true ? w['scopuly'] : undefined),
    address: (p) => withAccess(p, true),
    sign: positional,
  },
];

function injectedWallet(spec: InjectedStellarSpec, provider: Provider): StellarWallet {
  const id = `stellar:${spec.id}`;
  const run = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(spec.id, errorMessage(error), error);
    }
  };
  return {
    id,
    name: spec.name,
    ecosystem: 'stellar',
    connect: () => run(async () => pick(await spec.address(provider), ['address', 'publicKey'])),
    signTransaction: (xdr, options) =>
      run(async () =>
        pick(
          await spec.sign(provider, xdr, {
            networkPassphrase: PASSPHRASES[options.network],
            address: options.address,
          }),
          ['signedTxXdr', 'signedXDR', 'signedTransaction'],
        ),
      ),
  };
}

/** The injected Stellar wallets present in `win`. */
export function discoverInjectedStellarWallets(win: WalletWindow | undefined): StellarWallet[] {
  if (!win) return [];
  const globals = win as unknown as Record<string, any>;
  const out: StellarWallet[] = [];
  for (const spec of INJECTED_STELLAR_WALLETS) {
    let provider: Provider | undefined;
    try {
      provider = spec.provider(globals);
    } catch {
      provider = undefined;
    }
    if (provider && typeof provider === 'object') out.push(injectedWallet(spec, provider));
  }
  return out;
}
