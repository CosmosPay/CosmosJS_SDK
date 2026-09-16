import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';
import type {
  CreatePayinOptions,
  CreatePayinQuoteOptions,
  CreateTrustlineOptions,
  CreateVirtualAccountOptions,
  ListPayinsOptions,
  PayinData,
  PayinListData,
  PayinQuoteData,
  TrustlineData,
  VirtualAccountData,
} from '@/types/index';

/** A page of payins plus its pagination metadata. */
export interface PayinPage {
  items: PayinData[];
  total: number;
  take: number;
  skip: number;
}

/**
 * Fiat → stablecoin — `client.onramp`.
 *
 * Three steps, in this order and no other: **quote** (a price, valid for about
 * five minutes), **payin** (created FROM that quote, and what returns the funding
 * instructions the payer acts on), then the money arrives off-band and the payin
 * status moves on its own.
 *
 * There is no structure class here on purpose. A payin has no action of its own —
 * it is a mirror of the provider's record, read and re-read — so an object with a
 * client back-reference would carry a `fetch()` and nothing else.
 *
 * @example
 * const quote = await client.onramp.quote({
 *   blockchain_wallet_id: 'w_123',
 *   currency_type: 'sender',
 *   payment_method: 'pix',
 *   token: 'USDC',
 *   request_amount: 10_000, // minor units
 * });
 * const payin = await client.onramp.createPayin({ payin_quote_id: quote.id });
 * console.log(payin.instructions);
 */
export class OnrampManager {
  public readonly client: Client;
  private readonly route = '/onramp';

  constructor(client: Client) {
    this.client = client;
  }

  private get rest(): REST {
    return this.client.rest;
  }

  /** Price a payin. The quote expires — check `expires_at` before using it. */
  public quote(options: CreatePayinQuoteOptions): Promise<PayinQuoteData> {
    return this.rest.post<PayinQuoteData>(`${this.route}/quotes`, { body: options });
  }

  /** Create a payin from a quote. The response carries the funding instructions. */
  public createPayin(options: CreatePayinOptions): Promise<PayinData> {
    return this.rest.post<PayinData>(`${this.route}/payins`, { body: options });
  }

  /** List this consumer's payins (paginated). */
  public async payins(options: ListPayinsOptions = {}): Promise<PayinPage> {
    const data = await this.rest.get<PayinListData>(`${this.route}/payins`, {
      query: { take: options.take, skip: options.skip },
    });
    return { items: data.data, total: data.total, take: data.take, skip: data.skip };
  }

  /**
   * One payin. Served from the local mirror, refreshed from the provider when it
   * is stale — so this is the right call to poll, not the provider's own API.
   */
  public payin(id: string): Promise<PayinData> {
    return this.rest.get<PayinData>(`${this.route}/payins/${id}`);
  }

  /**
   * Build the unsigned trustline transaction an address needs before it can hold
   * the stablecoin the ramp pays out in.
   *
   * The envelope comes from the gateway, so a wallet signing it must decode and
   * bound it first — the issuer it names is the one the payout will use, and it is
   * not known to the caller in advance.
   */
  public createTrustline(options: CreateTrustlineOptions): Promise<TrustlineData> {
    return this.rest.post<TrustlineData>(`${this.route}/trustline`, { body: options });
  }

  /** Open a virtual account (a permanent bank reference) for a verified receiver. */
  public createVirtualAccount(
    receiverId: string,
    options: CreateVirtualAccountOptions,
  ): Promise<VirtualAccountData> {
    return this.rest.post<VirtualAccountData>(
      `${this.route}/receivers/${receiverId}/virtual-accounts`,
      { body: options },
    );
  }

  /** A receiver's virtual accounts. */
  public virtualAccounts(
    receiverId: string,
    options: ListPayinsOptions = {},
  ): Promise<VirtualAccountData> {
    return this.rest.get<VirtualAccountData>(
      `${this.route}/receivers/${receiverId}/virtual-accounts`,
      { query: { take: options.take, skip: options.skip } },
    );
  }
}
