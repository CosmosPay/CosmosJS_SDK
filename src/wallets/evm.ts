/**
 * EVM wallets (MetaMask, Rabby, Coinbase Wallet, OKX, Phantom's EVM side, any EIP-6963 wallet):
 * each announces its provider on `eip6963:announceProvider` when the page asks with
 * `eip6963:requestProvider`. A wallet too old to announce is reached through `window.ethereum`.
 */

import { WalletError } from '@/web/errors';
import { errorMessage } from '@/web/adapters/util';
import { toQuantity } from '@/wallets/encoding';
import type {
  Eip1193Provider,
  EvmChain,
  EvmTransaction,
  EvmWallet,
  WalletWindow,
} from '@/wallets/types';

/** What a wallet announces under EIP-6963. */
interface Eip6963Detail {
  info?: { uuid?: string; name?: string; icon?: string; rdns?: string };
  provider?: Eip1193Provider;
}

/** A mined transaction, as {@link EvmWallet.waitForTransaction} answers it. */
export interface EvmReceipt {
  hash: string;
  status: 'success' | 'reverted';
  blockNumber: number;
}

export interface EvmWaitOptions {
  /** Give up after this long (default two minutes). */
  timeoutMs?: number;
  /** How often to ask (default 1.5 s). */
  intervalMs?: number;
}

/** An EVM wallet, with a wait for a transaction it sent. */
export interface DiscoveredEvmWallet extends EvmWallet {
  /** Wait until `hash` is mined and answer its receipt (asked through the wallet's own node). */
  waitForTransaction(hash: string, options?: EvmWaitOptions): Promise<EvmReceipt>;
}

function isProvider(value: unknown): value is Eip1193Provider {
  return !!value && typeof (value as Eip1193Provider).request === 'function';
}

/** The code of an EIP-1193 error, also when a wallet nests it (MetaMask mobile does). */
function errorCode(error: unknown): number | undefined {
  const e = error as { code?: unknown; data?: { originalError?: { code?: unknown } } } | undefined;
  if (typeof e?.code === 'number' && e.code !== -32603) return e.code;
  const nested = e?.data?.originalError?.code;
  if (typeof nested === 'number') return nested;
  return typeof e?.code === 'number' ? e.code : undefined;
}

/** A name for a provider that did not announce itself, from the flags wallets set on it. */
function legacyName(provider: Record<string, unknown>): { id: string; name: string } {
  if (provider['isRabby']) return { id: 'io.rabby', name: 'Rabby' };
  if (provider['isCoinbaseWallet']) return { id: 'com.coinbase.wallet', name: 'Coinbase Wallet' };
  if (provider['isBraveWallet']) return { id: 'com.brave.wallet', name: 'Brave Wallet' };
  if (provider['isOkxWallet'] || provider['isOKExWallet']) return { id: 'com.okex.wallet', name: 'OKX Wallet' };
  if (provider['isTrust'] || provider['isTrustWallet']) return { id: 'com.trustwallet.app', name: 'Trust Wallet' };
  if (provider['isMetaMask']) return { id: 'io.metamask', name: 'MetaMask' };
  return { id: 'injected', name: 'Browser wallet' };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wrap one EIP-1193 provider. */
export function evmWallet(
  provider: Eip1193Provider,
  info: { id: string; name: string; icon?: string; rdns?: string },
): DiscoveredEvmWallet {
  const walletId = `evm:${info.id}`;
  const call = async <T>(method: string, params?: unknown[]): Promise<T> => {
    try {
      return (await provider.request(params ? { method, params } : { method })) as T;
    } catch (error) {
      throw new WalletError(walletId, errorMessage(error), error);
    }
  };

  const chainId = async () => Number(await call<string>('eth_chainId'));

  const switchChain = async (chain: EvmChain | number) => {
    const id = typeof chain === 'number' ? chain : chain.chainId;
    const hex = `0x${id.toString(16)}`;
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
    } catch (error) {
      // 4902: the wallet does not know the chain yet, so it is added (which also switches).
      if (errorCode(error) !== 4902) throw new WalletError(walletId, errorMessage(error), error);
      if (typeof chain === 'number') {
        throw new WalletError(walletId, `The wallet does not know chain ${id}: pass its details to add it.`, error);
      }
      await call('wallet_addEthereumChain', [
        {
          chainId: hex,
          chainName: chain.chainName,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: chain.rpcUrls,
          ...(chain.blockExplorerUrls ? { blockExplorerUrls: chain.blockExplorerUrls } : {}),
        },
      ]);
    }
  };

  return {
    id: walletId,
    name: info.name,
    icon: info.icon,
    rdns: info.rdns,
    ecosystem: 'evm',
    provider,
    async connect() {
      const accounts = await call<string[]>('eth_requestAccounts');
      const account = accounts?.[0];
      if (!account) throw new WalletError(walletId, 'The wallet shared no account.');
      return account;
    },
    chainId,
    switchChain,
    async sendTransaction(tx: EvmTransaction, chain?: EvmChain) {
      const target = tx.chainId ?? chain?.chainId;
      if (target !== undefined && (await chainId()) !== target) {
        await switchChain(chain && chain.chainId === target ? chain : target);
      }
      const params: Record<string, string> = { from: tx.from, to: tx.to };
      if (tx.data) params['data'] = tx.data;
      if (tx.value !== undefined && tx.value !== '0') params['value'] = toQuantity(tx.value);
      if (tx.gas) params['gas'] = toQuantity(tx.gas);
      if (tx.maxFeePerGas) params['maxFeePerGas'] = toQuantity(tx.maxFeePerGas);
      if (tx.maxPriorityFeePerGas) params['maxPriorityFeePerGas'] = toQuantity(tx.maxPriorityFeePerGas);
      const hash = await call<string>('eth_sendTransaction', [params]);
      if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        throw new WalletError(walletId, 'The wallet returned no transaction hash.');
      }
      return hash;
    },
    async waitForTransaction(hash, options = {}) {
      const deadline = Date.now() + (options.timeoutMs ?? 120_000);
      const interval = options.intervalMs ?? 1500;
      for (;;) {
        const receipt = await call<{ status?: string; blockNumber?: string } | null>(
          'eth_getTransactionReceipt',
          [hash],
        );
        if (receipt && receipt.blockNumber) {
          return {
            hash,
            status: receipt.status === '0x1' ? 'success' : 'reverted',
            blockNumber: Number(receipt.blockNumber),
          };
        }
        if (Date.now() >= deadline) {
          throw new WalletError(walletId, `Transaction ${hash} was not mined in time.`);
        }
        await sleep(interval);
      }
    },
  };
}

export interface EvmDiscoveryOptions {
  /** How long to listen for announcements (default 200 ms). */
  timeoutMs?: number;
}

/**
 * The EVM wallets in this browser: every EIP-6963 announcement (one per wallet, by `rdns`), or
 * the `window.ethereum` provider when nothing announced.
 */
export async function discoverEvmWallets(
  win: WalletWindow | undefined,
  options: EvmDiscoveryOptions = {},
): Promise<DiscoveredEvmWallet[]> {
  if (!win) return [];
  const found = new Map<string, DiscoveredEvmWallet>();
  const providers = new Set<Eip1193Provider>();
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (!detail || !isProvider(detail.provider) || !detail.info?.name) return;
    const key = detail.info.rdns || detail.info.uuid || detail.info.name;
    if (found.has(key)) return;
    providers.add(detail.provider);
    found.set(
      key,
      evmWallet(detail.provider, {
        id: key,
        name: detail.info.name,
        icon: detail.info.icon,
        rdns: detail.info.rdns,
      }),
    );
  };
  win.addEventListener('eip6963:announceProvider', onAnnounce);
  try {
    win.dispatchEvent(new Event('eip6963:requestProvider'));
    await sleep(options.timeoutMs ?? 200);
  } finally {
    win.removeEventListener('eip6963:announceProvider', onAnnounce);
  }
  const legacy = win.ethereum;
  if (found.size === 0 && isProvider(legacy) && !providers.has(legacy)) {
    const { id, name } = legacyName(legacy as unknown as Record<string, unknown>);
    found.set(id, evmWallet(legacy, { id, name }));
  }
  return [...found.values()];
}
