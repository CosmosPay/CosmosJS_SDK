/**
 * xBull — https://xbull.app
 *
 * Uses the extension-injected `window.xBullSDK` when present. You can also inject
 * a compatible SDK instance (e.g. one obtained from
 * `@creit.tech/xbull-wallet-connect`) for the web-app bridge fallback.
 */

import { WalletError } from '@/web/errors';
import type {
  NetworkConfig,
  SignParams,
  WalletAdapter,
} from '@/web/types';
import { errorMessage, globalRef } from '@/web/adapters/util';

interface XBullSDK {
  connect(permissions?: Record<string, boolean>): Promise<unknown>;
  getPublicKey(): Promise<string>;
  signXDR(
    xdr: string,
    options?: { network?: string; publicKey?: string },
  ): Promise<string>;
  closeConnections?(): void;
}

export class XBullAdapter implements WalletAdapter {
  public readonly id = 'xbull';
  public readonly name = 'xBull';

  constructor(private readonly injected?: XBullSDK) {}

  private sdk(): XBullSDK | undefined {
    return this.injected ?? globalRef<XBullSDK>('xBullSDK');
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(this.sdk());
  }

  public async getPublicKey(_network: NetworkConfig): Promise<string> {
    const sdk = this.sdk();
    if (!sdk) throw new WalletError(this.id, 'xBull is not available.');
    try {
      await sdk.connect({ canRequestPublicKey: true, canRequestSign: true });
      return await sdk.getPublicKey();
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async signTransaction(xdr: string, params: SignParams): Promise<string> {
    const sdk = this.sdk();
    if (!sdk) throw new WalletError(this.id, 'xBull is not available.');
    try {
      return await sdk.signXDR(xdr, {
        network: params.networkPassphrase,
        publicKey: params.address,
      });
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async disconnect(): Promise<void> {
    this.sdk()?.closeConnections?.();
  }
}
