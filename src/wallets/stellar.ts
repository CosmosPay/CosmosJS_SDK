/**
 * Stellar wallets: the SDK's own adapters (Freighter, xBull, Rabet, LOBSTR, Albedo, Cosmos Pay
 * Wallet), the wallets that inject a provider (Hana, Klever, OneKey, Bitget, Cactus Link, D'CENT,
 * Scopuly), plus every wallet of a Stellar Wallets Kit the app passes in (MetaMask's Stellar Snap,
 * Ledger, Trezor, WalletConnect...). A wallet several reach is listed once, the first way, with the
 * kit's name and icon.
 */

import { defaultAdapters, type InjectedWallets } from '@/web/adapters/index';
import { COSMOS_WALLET_ID } from '@/swk/CosmosWalletModule';
import { WalletError } from '@/web/errors';
import { errorMessage, getWindow } from '@/web/adapters/util';
import { discoverInjectedStellarWallets } from '@/wallets/stellar-injected';
import { HORIZON_URLS, PASSPHRASES } from '@/web/network';
import type { NetworkConfig, StellarNetwork, WalletAdapter } from '@/web/types';
import type {
  StellarKitWallet,
  StellarSignOptions,
  StellarWallet,
  StellarWalletsKitLike,
  WalletWindow,
} from '@/wallets/types';

export interface StellarDiscoveryOptions {
  /** Wallet libraries for the adapters that have no global (see `InjectedWallets`). */
  injected?: InjectedWallets;
  /** Adapters to use in place of the default set. */
  adapters?: WalletAdapter[];
  /** A Stellar Wallets Kit instance: its wallets join the list. */
  kit?: StellarWalletsKitLike;
  /** Look for the wallets that inject a provider (default true). */
  injectedProviders?: boolean;
  /** The window those wallets inject into (default the page's). */
  window?: WalletWindow;
  /**
   * How long an adapter has to say it is available (default 2500 ms). An extension that is not
   * installed may never answer its probe; past this it counts as absent.
   */
  availabilityTimeoutMs?: number;
}

/** The kit names some wallets differently from the adapters: the kit id to the adapter id. */
const KIT_TO_ADAPTER: Record<string, string> = {
  [COSMOS_WALLET_ID]: 'cosmos',
  // Freighter is now Varial: kit v2 lists it as `varial` (v1 as `freighter`).
  varial: 'freighter',
  BitgetWallet: 'bitget',
};

function networkConfig(network: StellarNetwork): NetworkConfig {
  return { network, passphrase: PASSPHRASES[network], horizonUrl: HORIZON_URLS[network] };
}

function fromAdapter(adapter: WalletAdapter, listed?: StellarKitWallet): StellarWallet {
  return {
    id: `stellar:${adapter.id}`,
    // The kit follows wallets' branding (Freighter became Varial): its name and icon win.
    name: listed?.name ?? adapter.name,
    icon: listed?.icon ?? adapter.icon,
    ecosystem: 'stellar',
    connect: (network) => adapter.getPublicKey(networkConfig(network)),
    signTransaction: (xdr, options: StellarSignOptions) =>
      adapter.signTransaction(xdr, {
        network: options.network,
        networkPassphrase: PASSPHRASES[options.network],
        address: options.address,
      }),
  };
}

function fromKit(kit: StellarWalletsKitLike, wallet: StellarKitWallet): StellarWallet {
  const id = `stellar:${wallet.id}`;
  // One kit serves every wallet it lists, so each call selects its wallet first.
  const run = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      kit.setWallet(wallet.id);
      return await work();
    } catch (error) {
      if (error instanceof WalletError) throw error;
      throw new WalletError(wallet.id, errorMessage(error), error);
    }
  };
  return {
    id,
    name: wallet.name,
    icon: wallet.icon,
    ecosystem: 'stellar',
    connect: () =>
      run(async () => (await (kit.fetchAddress ? kit.fetchAddress() : kit.getAddress())).address),
    signTransaction: (xdr, options) =>
      run(async () => {
        const { signedTxXdr } = await kit.signTransaction(xdr, {
          networkPassphrase: PASSPHRASES[options.network],
          address: options.address,
        });
        if (!signedTxXdr) throw new WalletError(wallet.id, 'The wallet returned no signed transaction.');
        return signedTxXdr;
      }),
  };
}

async function availableAdapters(
  adapters: WalletAdapter[],
  timeoutMs: number,
): Promise<WalletAdapter[]> {
  const checks = await Promise.all(
    adapters.map(async (adapter) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      });
      try {
        return (await Promise.race([adapter.isAvailable(), timeout])) ? adapter : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return checks.filter((adapter): adapter is WalletAdapter => adapter !== null);
}

/**
 * The Stellar wallets this browser can sign with right now: the installed or configured
 * adapters first, in their detection order, then the wallets that injected a provider, then the
 * kit's other available wallets.
 */
export async function discoverStellarWallets(
  options: StellarDiscoveryOptions = {},
): Promise<StellarWallet[]> {
  const adapters = await availableAdapters(
    options.adapters ?? defaultAdapters(options.injected),
    options.availabilityTimeoutMs ?? 2500,
  );
  let kitWallets: StellarKitWallet[] = [];
  const kit = options.kit;
  if (kit) {
    try {
      kitWallets =
        (await (kit.refreshSupportedWallets
          ? kit.refreshSupportedWallets()
          : kit.getSupportedWallets?.())) ?? [];
    } catch {
      kitWallets = [];
    }
  }
  const byAdapter = new Map(
    kitWallets.map((wallet) => [KIT_TO_ADAPTER[wallet.id] ?? wallet.id, wallet] as const),
  );
  const wallets = adapters.map((adapter) => fromAdapter(adapter, byAdapter.get(adapter.id)));
  const listed = new Set(adapters.map((adapter) => adapter.id));
  if (options.injectedProviders !== false) {
    const win = options.window ?? (getWindow() as WalletWindow | undefined);
    for (const wallet of discoverInjectedStellarWallets(win)) {
      const key = wallet.id.slice('stellar:'.length);
      if (listed.has(key)) continue;
      listed.add(key);
      const listing = byAdapter.get(key);
      wallets.push(listing ? { ...wallet, name: listing.name, icon: listing.icon ?? wallet.icon } : wallet);
    }
  }
  for (const wallet of kitWallets) {
    const adapterId = KIT_TO_ADAPTER[wallet.id] ?? wallet.id;
    if (wallet.isAvailable === false || listed.has(adapterId) || !kit) continue;
    listed.add(adapterId);
    wallets.push(fromKit(kit, wallet));
  }
  return wallets;
}
