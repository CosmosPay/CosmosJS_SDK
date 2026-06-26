/**
 * Types for the browser ("web client") side of the SDK.
 *
 * The web client never talks to a Stellar wallet through SEP-7 deep links —
 * Freighter, xBull, Albedo, Rabet & co. don't consume `web+stellar:` URIs from
 * a dapp. Instead the SDK *adapts* the Cosmos Pay response into a concrete
 * Stellar transaction (XDR) and asks the detected wallet to sign it. These
 * types describe that flow.
 */

import type { PaymentIntentData } from '@/types/index';
import type { WalletId } from '@/common/wallets';

/** The Stellar network a transaction targets. */
export type StellarNetwork = 'public' | 'testnet';

/** Fully-resolved network parameters used to build, sign and submit. */
export interface NetworkConfig {
  /** `public` (mainnet) or `testnet`. */
  network: StellarNetwork;
  /** Network passphrase, e.g. `Public Global Stellar Network ; September 2015`. */
  passphrase: string;
  /** Horizon base URL used to load accounts and submit transactions. */
  horizonUrl: string;
}

/**
 * Parsed parameters of a SEP-7 `web+stellar:` URI. The Cosmos Pay API returns
 * such a URI on every intent; the web client can act on either the structured
 * {@link PaymentIntentData} or the raw URI string.
 */
export interface Sep7Request {
  operation: 'tx' | 'pay';
  /** `tx` only: base64 TransactionEnvelope XDR. */
  xdr?: string;
  /** `pay` only: payee account / muxed account. */
  destination?: string;
  /** `pay` only: amount the destination receives. */
  amount?: string;
  /** `pay` only: asset code (absent ⇒ native XLM). */
  assetCode?: string;
  /** `pay` only: issuer of a non-native asset. */
  assetIssuer?: string;
  /** Memo value. */
  memo?: string;
  /** `MEMO_ID` | `MEMO_TEXT` | `MEMO_HASH` | `MEMO_RETURN`. */
  memoType?: string;
  /** Human-readable message shown to the user (≤ 300 chars). */
  msg?: string;
  /** `url:https://…` callback the signed XDR should be POSTed to. */
  callback?: string;
  /** Network passphrase for non-public networks. */
  networkPassphrase?: string;
  originDomain?: string;
  signature?: string;
}

/**
 * A normalized, wallet-agnostic view of "what to pay". The web client coerces
 * every accepted input — the server's {@link PaymentIntentData}, a parsed
 * {@link Sep7Request}, or a raw SEP-7 URI string — into this shape before
 * building a transaction.
 */
export interface NormalizedIntent {
  /** `tx` (source known, XDR present) or `pay` (wallet supplies the source). */
  kind: 'tx' | 'pay';
  /** Intent id, when acting on a {@link PaymentIntentData}. */
  id?: string;
  /** Network hint carried by the intent, if any (passphrase or label). */
  network: string | null;
  /** Payer account. `null` for `pay` intents (the connected wallet supplies it). */
  source: string | null;
  destination: string;
  /** Decimal amount string, or `null` when the user must enter it. */
  amount: string | null;
  /** Asset code, or `native` for XLM. */
  asset: string;
  assetIssuer: string | null;
  /** Memo value (MEMO_ID by default). */
  memo: string | null;
  memoType: string | null;
  msg: string | null;
  callback: string | null;
  /** Unsigned envelope (base64 XDR); `null` for `pay` intents. */
  xdr: string | null;
  /** The originating SEP-7 URI, when known. */
  uri: string | null;
}

/**
 * Anything the web client accepts as "the thing to pay": a server
 * {@link PaymentIntentData}, an already-parsed {@link Sep7Request}, a raw SEP-7
 * URI string, or any object exposing a `toJSON()` returning a
 * {@link PaymentIntentData} (e.g. a {@link PaymentIntent} structure instance).
 */
export type PayableInput =
  | PaymentIntentData
  | Sep7Request
  | string
  | { toJSON(): PaymentIntentData };

/** Lightweight descriptor of a wallet, as surfaced by detection. */
export interface WalletInfo {
  /** Stable id, e.g. `freighter`, `xbull`, `albedo`, `rabet`, `lobstr`. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Optional icon (data URL or remote URL). */
  icon?: string;
  /** Whether the wallet is currently usable (extension injected / lib present). */
  available: boolean;
}

/** Parameters passed to {@link WalletAdapter.signTransaction}. */
export interface SignParams {
  /** Network passphrase the wallet must sign for. */
  networkPassphrase: string;
  /** `public` / `testnet`, for wallets whose API takes a label not a passphrase. */
  network: StellarNetwork;
  /** Account expected to sign (helps multi-account wallets pick the right key). */
  address?: string;
}

/**
 * A pluggable wallet integration. The SDK ships adapters for the most common
 * Stellar wallets and auto-detects the right one, but you can register your own
 * (WalletConnect, Ledger, a custom signer…) via {@link WebClient.registerWallet}.
 */
export interface WalletAdapter {
  /** Stable id (used for selection and {@link WalletInfo.id}). */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Optional icon. */
  readonly icon?: string;
  /**
   * Whether this wallet is usable right now (e.g. the browser extension injected
   * its global, or the wallet's library was provided). Must never throw.
   */
  isAvailable(): Promise<boolean>;
  /** Connect (requesting permission if needed) and return the user's `G…` address. */
  getPublicKey(network: NetworkConfig): Promise<string>;
  /** Sign an unsigned XDR and return the signed XDR (base64). */
  signTransaction(xdr: string, params: SignParams): Promise<string>;
  /** Optional: tear down any connection/session. */
  disconnect?(): Promise<void>;
}

/** Result of {@link WebClient.connect}. */
export interface ConnectResult {
  /** Id of the wallet that connected. */
  wallet: string;
  /** Connected `G…` account. */
  address: string;
  /** Network the wallet reported / the client resolved. */
  network: StellarNetwork;
}

/** Options for {@link WebClient.pay} (and the lower-level builders). */
export interface PayOptions {
  /**
   * Force a specific wallet by id (e.g. `Wallets.FREIGHTER`). By default the
   * client auto-detects — you don't need to pass this.
   */
  wallet?: WalletId;
  /**
   * Override / supply the amount for an open `pay` intent (one created without a
   * fixed amount, e.g. a donation).
   */
  amount?: string;
  /**
   * For `pay` intents, the source account to build from. Defaults to the
   * connected wallet's address — you normally never set this.
   */
  source?: string;
  /** Skip Horizon submission and just return the signed XDR. */
  sign?: boolean;
  /**
   * Whether to submit the signed transaction. Defaults to `true` unless the
   * intent carries a SEP-7 `callback` (in which case the signed XDR is POSTed
   * there instead).
   */
  submit?: boolean;
  /** Per-call `AbortSignal`. */
  signal?: AbortSignal;
}

/** Outcome of a full {@link WebClient.pay} flow. */
export interface PayResult {
  /** Intent id, when paying a {@link PaymentIntentData}. */
  intentId?: string;
  /** Id of the wallet that signed. */
  wallet: string;
  /** Account that signed (the source). */
  account: string;
  /** Network used. */
  network: StellarNetwork;
  /** The signed transaction envelope (base64 XDR). */
  signedXdr: string;
  /** The transaction hash (hex) — stable whether submitted to Horizon or a callback. */
  txHash: string;
  /** Whether the transaction was broadcast (to Horizon or the SEP-7 callback). */
  submitted: boolean;
  /** Raw Horizon (or callback) response, when submitted. */
  response?: unknown;
}

/**
 * A Stellar SDK module, structurally typed to just the surface the web client
 * uses. Pass `@stellar/stellar-sdk` (or a compatible build) via
 * `new WebClient({ stellarSdk })`, or install it and let the client import it.
 */
export interface StellarSdkLike {
  TransactionBuilder: any;
  Account: any;
  Operation: any;
  Asset: any;
  Memo: any;
  BASE_FEE?: string;
  Networks?: Record<string, string>;
  Horizon?: { Server: any };
  Server?: any;
  [key: string]: any;
}
