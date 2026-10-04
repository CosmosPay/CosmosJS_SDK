import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  DefindexDepositOptions,
  DefindexWithdrawOptions,
} from '@/types/index';

/**
 * DeFindex vaults on Stellar — `client.defindex`. Served only where the
 * deployment enables the DeFindex native plugin (`PLUGINS_ENABLED=defindex`);
 * elsewhere every call is a 404.
 *
 * The payloads are DeFindex's own and are passed through untyped. Deposits and
 * withdrawals come back as an unsigned transaction for the caller to sign and
 * hand to {@link submit}.
 */
export class DefindexManager {
  public readonly client: Client;
  private readonly route = '/defindex';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  public vaults<T = unknown>(): Promise<T> {
    return this.rest.get<T>(`${this.route}/vaults`);
  }

  public vault<T = unknown>(vault: string): Promise<T> {
    return this.rest.get<T>(`${this.route}/vaults/${encodeURIComponent(vault)}`);
  }

  /** An account's position in a vault. */
  public balance<T = unknown>(vault: string, account: string): Promise<T> {
    return this.rest.get<T>(
      `${this.route}/vaults/${encodeURIComponent(vault)}/balance`,
      { query: { account } },
    );
  }

  public deposit<T = unknown>(vault: string, options: DefindexDepositOptions): Promise<T> {
    return this.rest.post<T>(
      `${this.route}/vaults/${encodeURIComponent(vault)}/deposit`,
      { body: options },
    );
  }

  public withdraw<T = unknown>(vault: string, options: DefindexWithdrawOptions): Promise<T> {
    return this.rest.post<T>(
      `${this.route}/vaults/${encodeURIComponent(vault)}/withdraw`,
      { body: options },
    );
  }

  /** Submit a signed DeFindex transaction (base64 XDR). */
  public submit<T = unknown>(xdr: string): Promise<T> {
    return this.rest.post<T>(`${this.route}/submit`, { body: { xdr } });
  }
}
