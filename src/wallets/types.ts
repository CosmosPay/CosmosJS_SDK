/**
 * The wallets a person can sign with, across the networks Cosmos Pay works with: one shape per
 * ecosystem, all discovered from the browser by {@link discoverWallets}. Nothing here imports a
 * wallet library: each ecosystem is reached through its own open standard (a wallet's injected
 * provider, EIP-6963 for EVM wallets, Wallet Standard for Solana wallets), or through a Stellar
 * Wallets Kit instance the app passes in.
 */

import type { StellarNetwork } from '@/web/types';

/** The families of wallets this module reaches. */
export type Ecosystem = 'stellar' | 'evm' | 'solana';

/** What every wallet tells about itself. */
export interface WalletDescriptor {
  /** Stable id, unique across ecosystems (`stellar:freighter`, `evm:io.metamask`, `solana:phantom`). */
  readonly id: string;
  /** The wallet's own name, as it presents itself. */
  readonly name: string;
  /** The wallet's own icon (a data: or https: URL), when it gives one. */
  readonly icon?: string;
  readonly ecosystem: Ecosystem;
}

/** Options for signing a Stellar transaction. */
export interface StellarSignOptions {
  /** `public` (mainnet) or `testnet`: the passphrase is derived from it. */
  network: StellarNetwork;
  /** The account expected to sign (multi-account wallets pick the right key). */
  address?: string;
}

/** A Stellar wallet: connects for a `G…` address and signs a transaction envelope (base64 XDR). */
export interface StellarWallet extends WalletDescriptor {
  readonly ecosystem: 'stellar';
  /** Ask the wallet for its address (it may prompt for permission). */
  connect(network: StellarNetwork): Promise<string>;
  /** Sign `xdr` and answer the signed envelope (base64 XDR). Nothing is submitted. */
  signTransaction(xdr: string, options: StellarSignOptions): Promise<string>;
}

/** An EIP-1193 provider, the interface every EVM wallet exposes. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

/** An EVM chain a wallet may need to switch to (or add first). */
export interface EvmChain {
  /** EIP-155 id (143 for Monad, 1 for Ethereum...). */
  chainId: number;
  /** Shown by the wallet when it adds the chain. */
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
}

/**
 * A transaction an EVM wallet sends (`eth_sendTransaction`). Amounts are decimal strings of wei
 * (or 0x-hex); the wallet estimates gas and fees unless given.
 */
export interface EvmTransaction {
  /** The sender: the connected account. */
  from: string;
  to: string;
  data?: string;
  value?: string;
  gas?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  /** The chain the transaction is for: the wallet is asked to switch to it first. */
  chainId?: number;
}

/** An EVM wallet (MetaMask, Rabby, Coinbase Wallet, any EIP-6963 wallet). */
export interface EvmWallet extends WalletDescriptor {
  readonly ecosystem: 'evm';
  /** The wallet's provider, for anything this module does not wrap. */
  readonly provider: Eip1193Provider;
  /** The wallet's reverse-DNS id from EIP-6963 (`io.metamask`), when announced. */
  readonly rdns?: string;
  /** Ask for the accounts and answer the first one (0x, as the wallet gives it). */
  connect(): Promise<string>;
  /** The chain the wallet is on (EIP-155 id). */
  chainId(): Promise<number>;
  /** Switch the wallet to `chain`, adding it first when the wallet does not know it. */
  switchChain(chain: EvmChain | number): Promise<void>;
  /**
   * Send `tx` from the wallet (it signs and broadcasts; EVM wallets cannot hand a signed
   * transaction back) and answer its hash. Switches chain first when `tx.chainId` is set.
   */
  sendTransaction(tx: EvmTransaction, chain?: EvmChain): Promise<string>;
}

/** Solana clusters, as Wallet Standard names them. */
export type SolanaChain = 'solana:mainnet' | 'solana:devnet' | 'solana:testnet';

/** A Solana wallet (Phantom, Solflare, Backpack, any Wallet Standard wallet). */
export interface SolanaWallet extends WalletDescriptor {
  readonly ecosystem: 'solana';
  /** The clusters the wallet supports. */
  readonly chains: readonly string[];
  /** Ask the wallet for its account and answer its address (base58). */
  connect(): Promise<string>;
  /**
   * Sign a serialized transaction (base64 wire bytes) and answer the signed one (base64):
   * nothing is broadcast, so a service can check it and relay it.
   */
  signTransaction(transaction: string, chain?: SolanaChain): Promise<string>;
  /** Whether the wallet can also sign and send in one step. */
  readonly canSignAndSend: boolean;
  /** Sign and broadcast (base64 wire bytes in), answering the signature (base58). */
  signAndSendTransaction(transaction: string, chain?: SolanaChain): Promise<string>;
}

export type AnyWallet = StellarWallet | EvmWallet | SolanaWallet;

/** A wallet as a Stellar Wallets Kit lists it. */
export interface StellarKitWallet {
  id: string;
  name: string;
  icon?: string;
  isAvailable?: boolean;
  type?: string;
}

/**
 * The parts of a Stellar Wallets Kit this module uses, in the kit's own API: v2's static class
 * (`StellarWalletsKit` after `StellarWalletsKit.init({ modules })`) and a v1 instance
 * (`new StellarWalletsKit({...})`) both fit.
 */
export interface StellarWalletsKitLike {
  /** v2: the kit's wallets, each checked for availability. */
  refreshSupportedWallets?(): Promise<StellarKitWallet[]>;
  /** v1: the kit's wallets. */
  getSupportedWallets?(): Promise<StellarKitWallet[]>;
  setWallet(id: string): void;
  /** v2: asks the selected wallet for its address (`getAddress` only reads the kit's memory). */
  fetchAddress?(): Promise<{ address: string }>;
  getAddress(): Promise<{ address: string }>;
  signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string; address?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
}

/** The browser objects discovery listens on (the page's `window`, or a stand-in in tests). */
export interface WalletWindow extends EventTarget {
  ethereum?: unknown;
}
