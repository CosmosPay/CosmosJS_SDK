import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  AttachPayoutDocumentOptions,
  AuthorizePayoutData,
  AuthorizePayoutOptions,
  CreatePayoutOptions,
  CreatePayoutQuoteOptions,
  ListPayoutsOptions,
  PayoutData,
  PayoutDocumentData,
  PayoutListData,
  PayoutQuoteData,
} from '@/types/index';

/** A page of payouts plus its pagination metadata. */
export interface PayoutPage {
  items: PayoutData[];
  total: number;
  take: number;
  skip: number;
}

/**
 * Stablecoin → fiat — `client.offramp`.
 *
 * Four steps, and the middle one is the one people miss: **quote**, **authorize**
 * (which builds the unsigned transaction that moves the stablecoin), the wallet
 * signs it, and only then **create the payout** with that signature attached. A
 * payout created without a signed transfer is a payout with nothing behind it.
 *
 * `authorize` is for the chains that need a transaction built for them (Stellar,
 * Solana). On EVM the quote itself carries the `approve` contract payload, so the
 * caller signs that instead and goes straight to `createPayout`.
 *
 * @example
 * const quote = await client.offramp.quote({
 *   bank_account_id: 'ba_123',
 *   currency_type: 'sender',
 *   request_amount: 5_000,
 *   network: 'stellar',
 *   token: 'USDC',
 * });
 * const { xdr } = await client.offramp.authorize({
 *   quote_id: quote.id,
 *   sender_wallet_address: 'G…',
 *   chain: 'stellar',
 * });
 * // …wallet signs `xdr`, after bounding it against `quote`…
 * const payout = await client.offramp.createPayout({
 *   quote_id: quote.id,
 *   sender_wallet_address: 'G…',
 *   chain: 'stellar',
 *   signed_transaction: signedXdr,
 * });
 */
export class OfframpManager {
  public readonly client: Client;
  private readonly route = '/offramp';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** Price a payout. Expires in about five minutes. */
  public quote(options: CreatePayoutQuoteOptions): Promise<PayoutQuoteData> {
    return this.rest.post<PayoutQuoteData>(`${this.route}/quotes`, { body: options });
  }

  /**
   * Build the unsigned transfer for a Stellar or Solana payout.
   *
   * What comes back is built by the gateway, not by the caller: bound it against
   * the quote the user confirmed before signing, or the amount that leaves is
   * whatever the response says it is.
   */
  public authorize(options: AuthorizePayoutOptions): Promise<AuthorizePayoutData> {
    return this.rest.post<AuthorizePayoutData>(`${this.route}/payouts/authorize`, {
      body: options,
    });
  }

  /** Create the payout from a quote, with the signed transfer attached. */
  public createPayout(options: CreatePayoutOptions): Promise<PayoutData> {
    return this.rest.post<PayoutData>(`${this.route}/payouts`, { body: options });
  }

  /** List this consumer's payouts (paginated). */
  public async payouts(options: ListPayoutsOptions = {}): Promise<PayoutPage> {
    const data = await this.rest.get<PayoutListData>(`${this.route}/payouts`, {
      query: { take: options.take, skip: options.skip },
    });
    return { items: data.data, total: data.total, take: data.take, skip: data.skip };
  }

  /** One payout. Served from the local mirror, refreshed when stale. */
  public payout(id: string): Promise<PayoutData> {
    return this.rest.get<PayoutData>(`${this.route}/payouts/${id}`);
  }

  /**
   * Attach a compliance document to a payout — an invoice or proof of funds the
   * rail asks for before it will settle.
   */
  public attachDocument(
    id: string,
    options: AttachPayoutDocumentOptions,
  ): Promise<PayoutDocumentData> {
    return this.rest.post<PayoutDocumentData>(`${this.route}/payouts/${id}/documents`, {
      body: options,
    });
  }
}
