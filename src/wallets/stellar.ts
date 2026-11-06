/**
 * Stellar wallets: the SDK's own adapters (Freighter, xBull, Rabet, LOBSTR, Albedo, Cosmos Pay
 * Wallet), plus every wallet of a Stellar Wallets Kit the app passes in (Hana, HOT, Ledger,
 * WalletConnect...). A wallet both reach is listed once, through the adapter, with the kit's icon.
 */

import { defaultAdapters, type InjectedWallets } from '@/web/adapters/index';
import { COSMOS_WALLET_ID } from '@/swk/CosmosWalletModule';
import { WalletError } from '@/web/errors';
import { errorMessage } from '@/web/adapters/util';
import { HORIZON_URLS, PASSPHRASES } from '@/web/network';
import type { NetworkConfig, StellarNetwork, WalletAdapter } from '@/web/types';
import type { StellarSignOptions, StellarWallet, StellarWalletsKitLike } from '@/wallets/types';

export interface StellarDiscoveryOptions {
  /** Wallet libraries for the adapters that have no global (see `InjectedWallets`). */
  injected?: InjectedWallets;
  /** Adapters to use in place of the default set. */
  adapters?: WalletAdapter[];
  /** A Stellar Wallets Kit instance: its wallets join the list. */
  kit?: StellarWalletsKitLike;
}

/** The kit names some wallets differently from the adapters: the kit id → the adapter id. */
const KIT_TO_ADAPTER: Record<string, string> = {
  [COSMOS_WALLET_ID]: 'cosmos',
};

function networkConfig(network: StellarNetwork): NetworkConfig {
  return { network, passphrase: PASSPHRASES[network], horizonUrl: HORIZON_URLS[network] };
}

function fromAdapter(adapter: WalletAdapter, icon?: string): StellarWallet {
  return {
    id: `stellar:${adapter.id}`,
    name: adapter.name,
    icon: adapter.icon ?? icon,
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

function fromKit(
  kit: StellarWalletsKitLike,
  wallet: { id: string; name: string; icon?: string },
): StellarWallet {
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
    connect: () => run(async () => (await kit.getAddress()).address),
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

async function availableAdapters(adapters: WalletAdapter[]): Promise<WalletAdapter[]> {
  const checks = await Promise.all(
    adapters.map(async (adapter) => {
      try {
        return (await adapter.isAvailable()) ? adapter : null;
      } catch {
        return null;
      }
    }),
  );
  return checks.filter((adapter): adapter is WalletAdapter => adapter !== null);
}

/**
 * The Stellar wallets this browser can sign with right now: the installed or configured
 * adapters first, in their detection order, then the kit's other available wallets.
 */
export async function discoverStellarWallets(
  options: StellarDiscoveryOptions = {},
): Promise<StellarWallet[]> {
  const adapters = await availableAdapters(options.adapters ?? defaultAdapters(options.injected));
  let kitWallets: Array<{ id: string; name: string; icon?: string; isAvailable?: boolean }> = [];
  if (options.kit) {
    try {
      kitWallets = await options.kit.getSupportedWallets();
    } catch {
      kitWallets = [];
    }
  }
  const kitIcon = new Map(
    kitWallets.map((wallet) => [KIT_TO_ADAPTER[wallet.id] ?? wallet.id, wallet.icon] as const),
  );
  const wallets = adapters.map((adapter) => fromAdapter(adapter, kitIcon.get(adapter.id)));
  const listed = new Set(adapters.map((adapter) => adapter.id));
  for (const wallet of kitWallets) {
    const adapterId = KIT_TO_ADAPTER[wallet.id] ?? wallet.id;
    if (wallet.isAvailable === false || listed.has(adapterId) || !options.kit) continue;
    listed.add(adapterId);
    wallets.push(fromKit(options.kit, wallet));
  }
  return wallets;
}
