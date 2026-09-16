/**
 * `@cosmosapp/pay_sdk/swk` — Cosmos Wallet for Stellar Wallets Kit.
 *
 * A separate entry point because it is a separate audience: a dapp that already
 * uses the kit imports this one file and gets a button for Cosmos Wallet, without
 * pulling in the payments client — and nothing here imports the kit itself, so the
 * cost of offering the wallet is zero for everyone who does not.
 *
 * @example
 * import { StellarWalletsKit, WalletNetwork, ModuleType, allowAllModules } from '@creit.tech/stellar-wallets-kit';
 * import { CosmosWalletModule } from '@cosmosapp/pay_sdk/swk';
 *
 * const kit = new StellarWalletsKit({
 *   network: WalletNetwork.PUBLIC,
 *   modules: [
 *     ...allowAllModules(),
 *     new CosmosWalletModule({ moduleType: ModuleType.HOT_WALLET }),
 *   ],
 * });
 */

export { CosmosWalletModule, COSMOS_WALLET_ID } from '@/swk/CosmosWalletModule';
export type { CosmosWalletModuleOptions } from '@/swk/CosmosWalletModule';

export { SwkModuleType } from '@/swk/types';
export type {
  IKitError,
  IOnChangeEvent,
  SwkModule,
  SwkModuleTypeValue,
  SwkSignOptions,
} from '@/swk/types';

// The transport, shared with the SDK's own web client. Exported so a host that
// already holds a provider (or serves the hosted wallet from a known origin) can
// wire it once and hand it to both.
export {
  injectedProvider,
  loadHostedProvider,
  resolveProvider,
  resetProviderCache,
} from '@/web/cosmosProvider';
export type { CosmosProviderOptions, CosmosWalletProvider } from '@/web/cosmosProvider';
