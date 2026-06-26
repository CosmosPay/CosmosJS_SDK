/**
 * LOBSTR — https://lobstr.co
 *
 * LOBSTR's vault extension is driven by the `@lobstrco/signer-extension-api`
 * package (message-based, no simple injected global). Because of that it can't
 * be reliably auto-detected from a global alone — pass the library in via
 * `new WebClient({ lobstr: signerApi })` to enable it. LOBSTR signs for
 * Stellar mainnet only.
 */

import { WalletError } from '@/web/errors';
import type {
  NetworkConfig,
  SignParams,
  WalletAdapter,
} from '@/web/types';
import { errorMessage } from '@/web/adapters/util';

interface LobstrApi {
  isConnected(): Promise<boolean>;
  getPublicKey(): Promise<string>;
  signTransaction(xdr: string): Promise<string>;
}

export class LobstrAdapter implements WalletAdapter {
  public readonly id = 'lobstr';
  public readonly name = 'LOBSTR';

  constructor(private readonly api?: LobstrApi) {}

  public async isAvailable(): Promise<boolean> {
    if (!this.api) return false;
    try {
      return await this.api.isConnected();
    } catch {
      return false;
    }
  }

  public async getPublicKey(_network: NetworkConfig): Promise<string> {
    if (!this.api) throw new WalletError(this.id, 'LOBSTR signer API not provided.');
    try {
      return await this.api.getPublicKey();
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }

  public async signTransaction(xdr: string, _params: SignParams): Promise<string> {
    if (!this.api) throw new WalletError(this.id, 'LOBSTR signer API not provided.');
    try {
      return await this.api.signTransaction(xdr);
    } catch (error) {
      throw new WalletError(this.id, errorMessage(error), error);
    }
  }
}
