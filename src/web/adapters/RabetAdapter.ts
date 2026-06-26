/**
 * Rabet — https://rabet.io
 *
 * MetaMask-style injected provider at `window.rabet`. `connect()` returns the
 * public key; `sign(xdr, network)` returns the signed XDR. Rabet uses the
 * `mainnet` / `testnet` network labels.
 */

import { WalletError } from '@/web/errors';
import { RABET_NETWORK } from '@/web/network';
import type {
  NetworkConfig,
  SignParams,
  WalletAdapter,
} from '@/web/types';
import { errorMessage, globalRef, unwrap } from '@/web/adapters/util';

interface RabetApi {
  connect(): Promise<{ publicKey: string } | string>;
  sign(xdr: string, network: string): Promise<{ xdr: string } | string>;
  disconnect?(): Promise<void>;
}

export class RabetAdapter implements WalletAdapter {
  public readonly id = 'rabet';
  public readonly name = 'Rabet';

  constructor(private readonly injected?: RabetApi) {}

  private api(): RabetApi | undefined {
    return this.injected ?? globalRef<RabetApi>('rabet');
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(this.api());
  }

  public async getPublicKey(_network: NetworkConfig): Promise<string> {
    const api = this.api();
    if (!api) throw new WalletError(this.id, 'Rabet is not available.');
    try {
      return unwrap<string>(await api.connect(), 'publicKey');
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async signTransaction(xdr: string, params: SignParams): Promise<string> {
    const api = this.api();
    if (!api) throw new WalletError(this.id, 'Rabet is not available.');
    try {
      const result = await api.sign(xdr, RABET_NETWORK[params.network]);
      return unwrap<string>(result, 'xdr');
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async disconnect(): Promise<void> {
    await this.api()?.disconnect?.();
  }
}
