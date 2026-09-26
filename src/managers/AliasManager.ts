import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  AddAliasAddressOptions,
  AliasAddressData,
  AliasAvailabilityData,
  AliasByAddressData,
  AliasChallengeData,
  AliasDeletedData,
  AliasListData,
  AliasResolutionData,
  ClaimAliasOptions,
  CompleteAliasRecoveryOptions,
  CreateAliasChallengeOptions,
  OwnedAliasData,
} from '@/types/index';

/**
 * Payment handles — `client.aliases`. A handle names one or more Stellar
 * addresses, so a payer can send to `@ada` instead of a 56-character key.
 *
 * Every address on a handle proved control of itself: claiming a handle or
 * pointing it somewhere new takes a signature, by that address, over a
 * challenge the server issued. The SDK never holds the key — ask for a
 * challenge, sign its `message` where the key lives, and send the signature
 * back.
 *
 * @example
 * const { primaryAddress } = await client.aliases.resolve('ada', { network: 'public' });
 *
 * @example
 * const ch = await client.aliases.createChallenge({ name: 'ada', address, network: 'public' });
 * const signature = signWithYourWallet(ch.message); // base64 ed25519
 * await client.aliases.claim({ name: 'ada', email: 'ada@example.com', nonce: ch.nonce, signature });
 */
export class AliasManager {
  public readonly client: Client;
  private readonly route = '/aliases';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** Where to pay a handle: its verified addresses on a network, primary first. */
  public resolve(name: string, options: { network?: string } = {}): Promise<AliasResolutionData> {
    return this.rest.get<AliasResolutionData>(`${this.route}/resolve/${encodeURIComponent(name)}`, {
      query: { network: options.network },
    });
  }

  /** Whether a handle can be claimed, and if not, why not. */
  public availability(name: string): Promise<AliasAvailabilityData> {
    return this.rest.get<AliasAvailabilityData>(`${this.route}/availability/${encodeURIComponent(name)}`);
  }

  /** Which handles point at an address — the reverse lookup. */
  public byAddress(address: string, options: { network?: string } = {}): Promise<AliasByAddressData> {
    return this.rest.get<AliasByAddressData>(`${this.route}/by-address/${encodeURIComponent(address)}`, {
      query: { network: options.network },
    });
  }

  /** A nonce and the exact message to sign, for a claim, a new address or a recovery. */
  public createChallenge(options: CreateAliasChallengeOptions): Promise<AliasChallengeData> {
    return this.rest.post<AliasChallengeData>(`${this.route}/challenges`, { body: options });
  }

  /** Claim a handle with a signature over a CLAIM challenge. */
  public claim(options: ClaimAliasOptions): Promise<OwnedAliasData> {
    return this.rest.post<OwnedAliasData>(this.route, { body: options });
  }

  /** The handles this consumer owns (paginated). */
  public list(options: { take?: number; skip?: number } = {}): Promise<AliasListData> {
    return this.rest.get<AliasListData>(this.route, {
      query: { take: options.take, skip: options.skip },
    });
  }

  /** Point a handle at another address, signed by that address (ADD_ADDRESS challenge). */
  public addAddress(name: string, options: AddAliasAddressOptions): Promise<AliasAddressData> {
    return this.rest.post<AliasAddressData>(`${this.route}/${encodeURIComponent(name)}/addresses`, {
      body: options,
    });
  }

  /** Remove one address from a handle. */
  public removeAddress(name: string, addressId: string): Promise<AliasDeletedData> {
    return this.rest.delete<AliasDeletedData>(
      `${this.route}/${encodeURIComponent(name)}/addresses/${encodeURIComponent(addressId)}`,
    );
  }

  /** Release a handle back to the namespace. */
  public release(name: string): Promise<AliasDeletedData> {
    return this.rest.delete<AliasDeletedData>(`${this.route}/${encodeURIComponent(name)}`);
  }

  /**
   * Take a handle over with a new address after losing the old one: the token
   * the owner received by email, plus a signature by the new address over a
   * RECOVER challenge.
   */
  public completeRecovery(name: string, options: CompleteAliasRecoveryOptions): Promise<OwnedAliasData> {
    return this.rest.post<OwnedAliasData>(`${this.route}/${encodeURIComponent(name)}/recovery/complete`, {
      body: options,
    });
  }
}
