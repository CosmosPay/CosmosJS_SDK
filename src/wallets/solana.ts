/**
 * Solana wallets (Phantom, Solflare, Backpack, any Wallet Standard wallet). A wallet registers
 * itself by dispatching `wallet-standard:register-wallet`; the page announces itself with
 * `wallet-standard:app-ready` so wallets that loaded first register too. Same protocol as
 * `@wallet-standard/app`, without the dependency.
 */

import { WalletError } from '@/web/errors';
import { errorMessage } from '@/web/adapters/util';
import { base64ToBytes, bytesToBase64 } from '@/wallets/encoding';
import type { SolanaChain, SolanaWallet, WalletWindow } from '@/wallets/types';

/** A Wallet Standard account (the parts used here). */
interface StandardAccount {
  address: string;
  publicKey?: Uint8Array;
  chains?: readonly string[];
  features?: readonly string[];
}

/** A Wallet Standard wallet (the parts used here). */
export interface StandardWallet {
  name: string;
  icon?: string;
  chains: readonly string[];
  accounts: readonly StandardAccount[];
  features: Record<string, unknown>;
}

interface ConnectFeature {
  connect(input?: { silent?: boolean }): Promise<{ accounts: readonly StandardAccount[] }>;
}
interface SignTransactionFeature {
  signTransaction(
    ...inputs: Array<{ account: StandardAccount; transaction: Uint8Array; chain?: string }>
  ): Promise<ReadonlyArray<{ signedTransaction: Uint8Array }>>;
}
interface SignAndSendFeature {
  signAndSendTransaction(
    ...inputs: Array<{ account: StandardAccount; transaction: Uint8Array; chain: string }>
  ): Promise<ReadonlyArray<{ signature: Uint8Array }>>;
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Bytes to base58 (Solana addresses and signatures). */
export function bytesToBase58(bytes: Uint8Array): string {
  const digits: number[] = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      carry += (digits[i] as number) << 8;
      digits[i] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let out = '';
  for (const byte of bytes) {
    if (byte !== 0) break;
    out += '1';
  }
  for (let i = digits.length - 1; i >= 0; i -= 1) out += BASE58[digits[i] as number];
  return out;
}

/** The registry of one window: every wallet that registered, kept for the page's life. */
interface Registry {
  wallets: Set<StandardWallet>;
}

const registries = new WeakMap<object, Registry>();

function registryOf(win: WalletWindow): Registry {
  const existing = registries.get(win);
  if (existing) return existing;
  const registry: Registry = { wallets: new Set() };
  const api = {
    register: (...wallets: StandardWallet[]) => {
      for (const wallet of wallets) registry.wallets.add(wallet);
      return () => {
        for (const wallet of wallets) registry.wallets.delete(wallet);
      };
    },
    get: () => [...registry.wallets],
    on: () => () => undefined,
  };
  win.addEventListener('wallet-standard:register-wallet', (event: Event) => {
    const callback = (event as CustomEvent<(api: unknown) => void>).detail;
    if (typeof callback === 'function') callback(api);
  });
  registries.set(win, registry);
  win.dispatchEvent(detailEvent('wallet-standard:app-ready', api));
  return registry;
}

/** An event carrying `detail` (a `CustomEvent` where there is one: Node 18 has none). */
function detailEvent(type: string, detail: unknown): Event {
  if (typeof CustomEvent === 'function') return new CustomEvent(type, { detail });
  return Object.assign(new Event(type), { detail });
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'wallet';
}

const isSolana = (wallet: StandardWallet) =>
  wallet.chains.some((chain) => chain.startsWith('solana:')) &&
  !!wallet.features['standard:connect'] &&
  (!!wallet.features['solana:signTransaction'] || !!wallet.features['solana:signAndSendTransaction']);

/** Wrap one Wallet Standard wallet. */
export function solanaWallet(wallet: StandardWallet): SolanaWallet {
  const id = `solana:${slug(wallet.name)}`;
  let account: StandardAccount | undefined;
  const fail = (error: unknown): never => {
    if (error instanceof WalletError) throw error;
    throw new WalletError(id, errorMessage(error), error);
  };
  const ensureAccount = async (): Promise<StandardAccount> => {
    if (account) return account;
    const connect = wallet.features['standard:connect'] as ConnectFeature;
    const { accounts } = await connect.connect();
    account = accounts[0] ?? wallet.accounts[0];
    if (!account) throw new WalletError(id, 'The wallet shared no account.');
    return account;
  };
  const signAndSend = wallet.features['solana:signAndSendTransaction'] as SignAndSendFeature | undefined;
  return {
    id,
    name: wallet.name,
    icon: wallet.icon,
    ecosystem: 'solana',
    chains: wallet.chains,
    canSignAndSend: !!signAndSend,
    async connect() {
      try {
        account = undefined;
        return (await ensureAccount()).address;
      } catch (error) {
        return fail(error);
      }
    },
    async signTransaction(transaction: string, chain: SolanaChain = 'solana:mainnet') {
      try {
        const feature = wallet.features['solana:signTransaction'] as SignTransactionFeature | undefined;
        if (!feature) throw new WalletError(id, 'This wallet can only sign and send in one step.');
        const signer = await ensureAccount();
        const [output] = await feature.signTransaction({
          account: signer,
          transaction: base64ToBytes(transaction),
          chain,
        });
        if (!output?.signedTransaction) throw new WalletError(id, 'The wallet returned no signed transaction.');
        return bytesToBase64(output.signedTransaction);
      } catch (error) {
        return fail(error);
      }
    },
    async signAndSendTransaction(transaction: string, chain: SolanaChain = 'solana:mainnet') {
      try {
        if (!signAndSend) throw new WalletError(id, 'This wallet cannot send a transaction.');
        const signer = await ensureAccount();
        const [output] = await signAndSend.signAndSendTransaction({
          account: signer,
          transaction: base64ToBytes(transaction),
          chain,
        });
        if (!output?.signature) throw new WalletError(id, 'The wallet returned no signature.');
        return bytesToBase58(output.signature);
      } catch (error) {
        return fail(error);
      }
    },
  };
}

/** The Solana wallets registered in this browser (Wallet Standard). */
export function discoverSolanaWallets(win: WalletWindow | undefined): SolanaWallet[] {
  if (!win) return [];
  const seen = new Set<string>();
  const out: SolanaWallet[] = [];
  for (const wallet of registryOf(win).wallets) {
    if (!isSolana(wallet)) continue;
    const descriptor = solanaWallet(wallet);
    if (seen.has(descriptor.id)) continue;
    seen.add(descriptor.id);
    out.push(descriptor);
  }
  return out;
}
