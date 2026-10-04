import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type { PublicKeyData } from '@/types/index';

/**
 * The shared public API key — `client.publicKey`. It is what an open-source
 * wallet embeds to reach the few routes anonymous callers may use; the route
 * that serves it takes no key at all. Mostly useful to tooling that ships such
 * a wallet; a server with its own key has no need for it.
 */
export class PublicKeyManager {
  public readonly client: Client;
  private readonly route = '/public-key';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** The public key for an environment (`dev` → testnet, `prod` → mainnet). */
  public fetch(env: 'dev' | 'prod' = 'dev'): Promise<PublicKeyData> {
    return this.rest.get<PublicKeyData>(this.route, { query: { env } });
  }
}
