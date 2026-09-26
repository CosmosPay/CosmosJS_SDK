import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type { AssetRegistryData, ListRegistryAssetsOptions } from '@/types/index';

/**
 * The server's asset registry — `client.assets`: which `(code, issuer)` pairs
 * it knows per network, and who issues each.
 *
 * A code is not an identifier — mainnet carries dozens of accounts issuing
 * `USDC` — so this is where to learn WHICH one. `verified` is a claim about the
 * issuer's identity (checked against `issuerName`), not about quality; the
 * unverified rows are returned too, and a UI should show them below a warning
 * rather than hide them. The static {@link Assets} catalog is the offline
 * fallback; this is the current list, and its `version` says which is newer.
 *
 * @example
 * const { data } = await client.assets.list({ network: 'public', verified: true });
 */
export class AssetManager {
  public readonly client: Client;
  private readonly route = '/assets';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** The registry for a network. */
  public list(options: ListRegistryAssetsOptions = {}): Promise<AssetRegistryData> {
    return this.rest.get<AssetRegistryData>(this.route, {
      query: { network: options.network, verified: options.verified },
    });
  }
}
