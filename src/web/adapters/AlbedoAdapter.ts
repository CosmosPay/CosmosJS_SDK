/**
 * Albedo — https://albedo.link
 *
 * Albedo has no browser extension; it works through a popup served from
 * albedo.link, driven by the `@albedo-link/intent` library. It's therefore only
 * "available" when that library is present — either as the UMD global
 * `window.albedo` or injected explicitly via the constructor.
 */

import { WalletError } from '@/web/errors';
import type {
  NetworkConfig,
  SignParams,
  WalletAdapter,
} from '@/web/types';
import { errorMessage, globalRef } from '@/web/adapters/util';

interface AlbedoIntent {
  publicKey(params?: { token?: string }): Promise<{ pubkey: string }>;
  tx(params: {
    xdr: string;
    network?: string;
    pubkey?: string;
    submit?: boolean;
  }): Promise<{ signed_envelope_xdr: string; tx_hash?: string }>;
}

export class AlbedoAdapter implements WalletAdapter {
  public readonly id = 'albedo';
  public readonly name = 'Albedo';

  constructor(private readonly injected?: AlbedoIntent) {}

  private intent(): AlbedoIntent | undefined {
    return this.injected ?? globalRef<AlbedoIntent>('albedo');
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(this.intent());
  }

  public async getPublicKey(_network: NetworkConfig): Promise<string> {
    const albedo = this.intent();
    if (!albedo) throw new WalletError(this.id, 'Albedo is not available.');
    try {
      const result = await albedo.publicKey();
      return result.pubkey;
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async signTransaction(xdr: string, params: SignParams): Promise<string> {
    const albedo = this.intent();
    if (!albedo) throw new WalletError(this.id, 'Albedo is not available.');
    try {
      const result = await albedo.tx({
        xdr,
        // Albedo expects the `public` / `testnet` label, not a passphrase.
        network: params.network,
        pubkey: params.address,
        submit: false,
      });
      return result.signed_envelope_xdr;
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }
}
