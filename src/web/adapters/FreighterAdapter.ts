/**
 * Freighter — https://www.freighter.app
 *
 * Talks to the extension's injected `window.freighterApi` directly (so the
 * `@stellar/freighter-api` npm package is *not* required), and also accepts that
 * package injected explicitly. Handles both the modern `{ value, error }`
 * envelope API and the older bare-value API.
 */

import { WalletError } from '@/web/errors';
import type {
  NetworkConfig,
  SignParams,
  WalletAdapter,
} from '@/web/types';
import { errorMessage, globalRef, unwrap } from '@/web/adapters/util';

interface FreighterApi {
  isConnected(): Promise<unknown>;
  requestAccess?(): Promise<unknown>;
  getAddress?(): Promise<unknown>;
  getPublicKey?(): Promise<unknown>;
  signTransaction(xdr: string, opts?: unknown): Promise<unknown>;
}

export class FreighterAdapter implements WalletAdapter {
  public readonly id = 'freighter';
  public readonly name = 'Freighter';

  constructor(private readonly injected?: FreighterApi) {}

  private api(): FreighterApi | undefined {
    return this.injected ?? globalRef<FreighterApi>('freighterApi');
  }

  public async isAvailable(): Promise<boolean> {
    const api = this.api();
    if (!api) return false;
    try {
      // `isConnected` resolves truthy when the extension is present & unlocked.
      const result = await api.isConnected();
      return unwrap<boolean>(result, 'isConnected') !== false;
    } catch {
      // The global exists ⇒ Freighter is installed even if this probe throws.
      return true;
    }
  }

  public async getPublicKey(_network: NetworkConfig): Promise<string> {
    const api = this.api();
    if (!api) throw new WalletError(this.id, 'Freighter is not available.');
    try {
      if (api.requestAccess) {
        const result = await api.requestAccess();
        const address = unwrap<string>(result, 'address');
        if (address) return address;
      }
      if (api.getAddress) {
        return unwrap<string>(await api.getAddress(), 'address');
      }
      if (api.getPublicKey) {
        return unwrap<string>(await api.getPublicKey(), 'address');
      }
      throw new Error('No address method exposed by Freighter.');
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async signTransaction(xdr: string, params: SignParams): Promise<string> {
    const api = this.api();
    if (!api) throw new WalletError(this.id, 'Freighter is not available.');
    try {
      const result = await api.signTransaction(xdr, {
        networkPassphrase: params.networkPassphrase,
        network: params.network,
        address: params.address,
        accountToSign: params.address,
      });
      return unwrap<string>(result, 'signedTxXdr');
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }
}
