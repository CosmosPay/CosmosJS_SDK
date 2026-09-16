/**
 * Built-in wallet adapters and the default registration set.
 *
 * Auto-detection order (first available wins): Freighter → xBull → Rabet →
 * LOBSTR → Albedo → Cosmos Wallet. Freighter, xBull and Rabet inject browser globals so they're
 * detected with zero configuration; LOBSTR and Albedo need their library passed
 * in (no reliable global), so they only activate when injected.
 */

import type { WalletAdapter } from '@/web/types';
import { FreighterAdapter } from '@/web/adapters/FreighterAdapter';
import { XBullAdapter } from '@/web/adapters/XBullAdapter';
import { RabetAdapter } from '@/web/adapters/RabetAdapter';
import { LobstrAdapter } from '@/web/adapters/LobstrAdapter';
import { AlbedoAdapter } from '@/web/adapters/AlbedoAdapter';
import { CosmosWalletAdapter } from '@/web/adapters/CosmosWalletAdapter';
import type { CosmosProviderOptions, CosmosWalletProvider } from '@/web/cosmosProvider';

export { FreighterAdapter } from '@/web/adapters/FreighterAdapter';
export { XBullAdapter } from '@/web/adapters/XBullAdapter';
export { RabetAdapter } from '@/web/adapters/RabetAdapter';
export { LobstrAdapter } from '@/web/adapters/LobstrAdapter';
export { AlbedoAdapter } from '@/web/adapters/AlbedoAdapter';
export { CosmosWalletAdapter } from '@/web/adapters/CosmosWalletAdapter';

/**
 * Optional wallet libraries to enable wallets that have no auto-detectable
 * global (LOBSTR, Albedo) or to use a non-extension transport (xBull web-app
 * bridge). Everything here is optional — extension wallets need nothing.
 */
export interface InjectedWallets {
  /** An `@stellar/freighter-api` module (otherwise `window.freighterApi`). */
  freighter?: any;
  /** An xBull SDK instance (otherwise `window.xBullSDK`). */
  xBull?: any;
  /** A Rabet provider (otherwise `window.rabet`). */
  rabet?: any;
  /** An `@albedo-link/intent` module/global (otherwise `window.albedo`). */
  albedo?: any;
  /** A `@lobstrco/signer-extension-api` module. */
  lobstr?: any;
  /**
   * A Cosmos Wallet provider, or `{ walletUrl }` to reach the HOSTED wallet when
   * the extension is absent (otherwise `window.cosmosWallet`).
   */
  cosmos?: CosmosWalletProvider | CosmosProviderOptions;
}

/**
 * Build the default adapter set, honoring any injected wallet libraries. The
 * order here is the auto-detection priority.
 */
export function defaultAdapters(injected: InjectedWallets = {}): WalletAdapter[] {
  return [
    new FreighterAdapter(injected.freighter),
    new XBullAdapter(injected.xBull),
    new RabetAdapter(injected.rabet),
    new LobstrAdapter(injected.lobstr),
    new AlbedoAdapter(injected.albedo),
    // Appended LAST on purpose. Auto-detection takes the first available adapter,
    // so putting the first-party wallet at the front would silently move an
    // existing integration off Freighter the day a user installs Cosmos Wallet.
    // A dapp that wants it preferred says so — `pay({ wallet: Wallets.COSMOS })`,
    // or `registry.register(adapter, true)`.
    new CosmosWalletAdapter(injected.cosmos ?? {}),
  ];
}
