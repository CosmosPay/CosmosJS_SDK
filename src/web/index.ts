/**
 * `@cosmosapp/pay_sdk/web` — the browser ("web client") entry point.
 *
 * Use this in front-end apps to *complete* a Cosmos Pay intent: it auto-detects
 * the user's Stellar wallet (Freighter, xBull, Rabet, LOBSTR, Albedo, …),
 * adapts the SEP-7 response into a transaction the wallet can sign (these
 * wallets don't ingest `web+stellar:` URIs directly), requests the signature,
 * and optionally submits — all provider-agnostic, no provider argument needed.
 *
 * For the server side (creating intents, webhooks, products, analytics) import
 * from `@cosmosapp/pay_sdk` instead.
 *
 * @example
 * import { WebClient } from '@cosmosapp/pay_sdk/web';
 *
 * const webClient = new WebClient();
 * const { txHash, account, wallet } = await webClient.pay(intentFromYourServer);
 */

// Client
export { WebClient } from '@/web/WebClient';
export type { WebClientOptions } from '@/web/WebClient';

// Wallet registry + adapters
export { WalletRegistry } from '@/web/WalletRegistry';
export {
  FreighterAdapter,
  XBullAdapter,
  RabetAdapter,
  LobstrAdapter,
  AlbedoAdapter,
  defaultAdapters,
} from '@/web/adapters/index';
export type { InjectedWallets } from '@/web/adapters/index';

// SEP-7 + intent normalization
export { isSep7Uri, parseSep7, normalizeIntent } from '@/web/sep7';

// Network helpers
export {
  resolveNetwork,
  classifyNetwork,
  isPassphrase,
  PASSPHRASES,
  HORIZON_URLS,
} from '@/web/network';
export type { ResolveNetworkInput } from '@/web/network';

// Stellar helpers (advanced)
export {
  loadStellarSdk,
  buildPaymentXdr,
  transactionHash,
  submitToHorizon,
  postToCallback,
} from '@/web/stellar';
export type { BuildPaymentInput } from '@/web/stellar';

// Errors
export {
  CosmosPayWebError,
  WalletNotFoundError,
  WalletError,
  StellarSdkRequiredError,
  IntentError,
} from '@/web/errors';

// Browser-safe REST (advanced)
export { WebREST } from '@/web/rest';
export type { WebRESTOptions, WebRequestOptions } from '@/web/rest';

// Reuse the shared API error classes so `catch` works across entries.
export {
  CosmosPayAPIError,
  CosmosPayRequestError,
} from '@/errors/CosmosPayError';

// Typed catalogs — assets (with verified issuers), wallets and address helpers
export {
  Assets,
  TestnetAssets,
  defineAsset,
  resolveAsset,
  isNativeAsset,
  Wallets,
  AddressBook,
  addresses,
  resolveAddress,
  isStellarAddress,
  isMuxedAddress,
  isContractAddress,
  isAddress,
  assertAddress,
  resolveIntentBody,
} from '@/common/index';
export type {
  AssetDefinition,
  AssetRef,
  ResolvedAsset,
  WalletId,
  AddressRef,
  ResolvableIntentInput,
} from '@/common/index';

// Types
export type {
  StellarNetwork,
  NetworkConfig,
  Sep7Request,
  NormalizedIntent,
  PayableInput,
  WalletInfo,
  WalletAdapter,
  SignParams,
  ConnectResult,
  PayOptions,
  PayResult,
  StellarSdkLike,
} from '@/web/types';

// Re-export the intent payload type for convenience.
export type { PaymentIntentData } from '@/types/index';
