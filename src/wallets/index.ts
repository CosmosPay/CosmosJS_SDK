/**
 * `@cosmosapp/pay_sdk/wallets`: every wallet a person can sign with, across ecosystems, from one
 * call. Stellar wallets through the SDK's adapters (and a Stellar Wallets Kit, when passed), EVM
 * wallets through EIP-6963 (MetaMask, Rabby, Coinbase Wallet...), Solana wallets through Wallet
 * Standard (Phantom, Solflare, Backpack...). No wallet library is bundled or required.
 *
 * @example
 * import { discoverWallets } from '@cosmosapp/pay_sdk/wallets';
 *
 * const wallets = await discoverWallets({ ecosystems: ['evm'] });
 * const metamask = wallets.find((w) => w.ecosystem === 'evm');
 * const from = await metamask.connect();
 * const hash = await metamask.sendTransaction({ from, to, data, value, chainId: 143 }, EvmChains.monad);
 */

import { getWindow } from '@/web/adapters/util';
import { discoverStellarWallets, type StellarDiscoveryOptions } from '@/wallets/stellar';
import { discoverEvmWallets, type DiscoveredEvmWallet } from '@/wallets/evm';
import { discoverSolanaWallets } from '@/wallets/solana';
import type {
  Ecosystem,
  EvmChain,
  SolanaWallet,
  StellarWallet,
  WalletWindow,
} from '@/wallets/types';

export { discoverStellarWallets } from '@/wallets/stellar';
export { discoverInjectedStellarWallets, INJECTED_STELLAR_WALLETS } from '@/wallets/stellar-injected';
export type { StellarDiscoveryOptions } from '@/wallets/stellar';
export { discoverEvmWallets, evmWallet } from '@/wallets/evm';
export type { DiscoveredEvmWallet, EvmDiscoveryOptions, EvmReceipt, EvmWaitOptions } from '@/wallets/evm';
export { discoverSolanaWallets, solanaWallet, bytesToBase58 } from '@/wallets/solana';
export type { StandardWallet } from '@/wallets/solana';
export { base64ToBytes, bytesToBase64, toQuantity, erc20TransferData } from '@/wallets/encoding';
export { parseEip681 } from '@/wallets/eip681';
export type { Eip681Transaction } from '@/wallets/eip681';
export type {
  Ecosystem,
  WalletDescriptor,
  StellarWallet,
  StellarSignOptions,
  StellarWalletsKitLike,
  StellarKitWallet,
  EvmWallet,
  EvmChain,
  EvmTransaction,
  Eip1193Provider,
  SolanaWallet,
  SolanaChain,
  AnyWallet,
  WalletWindow,
} from '@/wallets/types';
export { WalletError } from '@/web/errors';

/** EVM chains Cosmos Pay works on, ready for {@link EvmWallet.switchChain}. */
export const EvmChains = {
  monad: {
    chainId: 143,
    chainName: 'Monad',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: ['https://rpc.monad.xyz'],
    blockExplorerUrls: ['https://monadscan.com'],
  },
  monadTestnet: {
    chainId: 10143,
    chainName: 'Monad Testnet',
    nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
    rpcUrls: ['https://testnet-rpc.monad.xyz'],
    blockExplorerUrls: ['https://testnet.monadexplorer.com'],
  },
} as const satisfies Record<string, EvmChain>;

export interface DiscoverWalletsOptions {
  /** Which ecosystems to look in (default all three). */
  ecosystems?: Ecosystem[];
  /** Stellar: injected wallet libraries, adapters, a Stellar Wallets Kit. */
  stellar?: StellarDiscoveryOptions;
  /** The window to look in (default the page's; none outside a browser). */
  window?: WalletWindow;
  /** How long EVM wallets get to announce themselves (default 200 ms). */
  timeoutMs?: number;
}

/** The wallets of each ecosystem, as {@link discoverWallets} answers them. */
export interface DiscoveredWallets {
  stellar: StellarWallet[];
  evm: DiscoveredEvmWallet[];
  solana: SolanaWallet[];
}

/**
 * Every wallet this browser can sign with, by ecosystem. Outside a browser (SSR) every list is
 * empty, unless `window` is given.
 */
export async function discoverWallets(options: DiscoverWalletsOptions = {}): Promise<DiscoveredWallets> {
  const want = new Set<Ecosystem>(options.ecosystems ?? ['stellar', 'evm', 'solana']);
  const win = options.window ?? (getWindow() as WalletWindow | undefined);
  const [stellar, evm] = await Promise.all([
    want.has('stellar')
      ? discoverStellarWallets({ window: win, ...options.stellar })
      : Promise.resolve([]),
    want.has('evm') ? discoverEvmWallets(win, { timeoutMs: options.timeoutMs }) : Promise.resolve([]),
  ]);
  // Solana last: wallets that answered `app-ready` while EVM wallets announced are in by now.
  const solana = want.has('solana') ? discoverSolanaWallets(win) : [];
  return { stellar, evm, solana };
}

/**
 * Whether `error` is the person declining in their wallet (closing the prompt, pressing
 * reject), as opposed to a failure worth reporting.
 */
export function isUserRejection(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const e = current as { code?: unknown; message?: unknown; cause?: unknown };
    if (e.code === 4001 || e.code === 'ACTION_REJECTED') return true;
    if (typeof e.message === 'string' && /reject|declin|denied|cancel/i.test(e.message)) return true;
    current = e.cause;
  }
  return typeof error === 'string' && /reject|declin|denied|cancel/i.test(error);
}
