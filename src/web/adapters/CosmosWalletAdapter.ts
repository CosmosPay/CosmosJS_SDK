/**
 * Cosmos Wallet — https://github.com/CosmosPay/CosmosPay-Wallet
 *
 * Cosmos Pay's own non-custodial Stellar wallet. It reaches the page two ways and
 * this adapter serves both: the browser extension injects `window.cosmosWallet`,
 * and the hosted build is loaded from the wallet's own origin when `walletUrl` is
 * configured (see `@/web/cosmosProvider`). Everything below is the same either way.
 *
 * It is the only adapter here that is first-party, which is exactly why it is not
 * privileged: it sits in the same detection order as the rest and answers the same
 * three questions. A wallet that needed special treatment in the client would be a
 * wallet the client could not swap out.
 */

import { WalletError } from '@/web/errors';
import type { NetworkConfig, SignParams, WalletAdapter } from '@/web/types';
import { errorMessage, unwrap } from '@/web/adapters/util';
import {
  injectedProvider,
  resolveProvider,
  type CosmosProviderOptions,
  type CosmosWalletProvider,
} from '@/web/cosmosProvider';

export class CosmosWalletAdapter implements WalletAdapter {
  public readonly id = 'cosmos';
  public readonly name = 'Cosmos Wallet';

  private readonly options: CosmosProviderOptions;

  /**
   * @param options - A provider to use directly, or the origin of a hosted Cosmos
   *   Wallet to fall back to. Both optional: with the extension installed there is
   *   nothing to configure.
   */
  constructor(options: CosmosProviderOptions | CosmosWalletProvider = {}) {
    // Accept a bare provider too, so this adapter is injected the same way the
    // others are (`new FreighterAdapter(api)`).
    this.options = isProvider(options) ? { provider: options } : options;
  }

  /**
   * Available when a provider is already here, or when a hosted wallet is
   * configured — the hosted build needs no install, so it is always usable.
   *
   * Deliberately does NOT wait for the hosted script: this answer gates a modal,
   * and a wallet that takes a network round trip to say "yes" reads as broken. The
   * script is fetched on the first real call instead.
   */
  public async isAvailable(): Promise<boolean> {
    if (this.options.provider) return true;
    if (injectedProvider()) return true;
    return !!this.options.walletUrl;
  }

  private async provider(): Promise<CosmosWalletProvider> {
    const provider = await resolveProvider(this.options);
    if (!provider) throw new WalletError(this.id, 'Cosmos Wallet is not available.');
    return provider;
  }

  public async getPublicKey(_network: NetworkConfig): Promise<string> {
    try {
      const provider = await this.provider();
      return unwrap<string>(await provider.getAddress(), 'address');
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async signTransaction(xdr: string, params: SignParams): Promise<string> {
    try {
      const provider = await this.provider();
      // The passphrase is passed, and the wallet is expected to REFUSE a mismatch
      // rather than sign against it — it parses with its own network config, so a
      // caller-supplied passphrase can never redirect a signature to another
      // network. Passing it is how the caller learns about a mismatch at all.
      const result = await provider.signTransaction(xdr, {
        networkPassphrase: params.networkPassphrase,
        address: params.address,
      });
      return unwrap<string>(result, 'signedTxXdr');
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }
}

/** Tell a provider object from an options bag: only the former can sign. */
function isProvider(value: CosmosProviderOptions | CosmosWalletProvider): value is CosmosWalletProvider {
  return typeof (value as CosmosWalletProvider).signTransaction === 'function';
}
