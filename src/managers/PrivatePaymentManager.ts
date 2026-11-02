import { pathSegment } from '@/util/path';
import { PrivatePayment } from '@/structures/PrivatePayment';
import type {
  CreatePrivatePaymentOptions,
  ListPrivatePaymentsOptions,
  PrivatePaymentData,
  PrivatePaymentListData,
  PrivatePaymentsConfigData,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

/** A page of private payments plus its pagination metadata. */
export interface PrivatePaymentPage {
  items: PrivatePayment[];
  total: number;
  take: number;
  skip: number;
}

/**
 * Private payments: `client.privatePayments`.
 *
 * A private payment hides its amount on-chain. It is priced in XLM and paid with
 * confidential transfers on Cosmos Pay's confidential token; the merchant
 * receives `amount` minus a 0.18% commission. They run on Stellar testnet only
 * for now: on mainnet, {@link config} answers `enabled: false`.
 *
 * The SDK creates and reads them with your API key. The payer completes one in
 * the private checkout, which proves the transfers in their own browser.
 *
 * @example
 * const payment = await client.privatePayments.create({
 *   amount: '25.5', recipient: 'G...', description: 'Order #24',
 * });
 * // ...the payer pays it through the private checkout...
 * await payment.fetch(); // payment.status: PENDING, then SUCCEEDED (or EXPIRED)
 */
export class PrivatePaymentManager extends BaseManager<PrivatePayment> {
  private readonly route = '/zk-payments';

  /**
   * Create a private payment. The server prices it (`amount` = `netAmount` +
   * `feeAmount`) and checks on-chain that the recipient holds a confidential
   * account on the token, refusing it with `recipient_not_registered` otherwise.
   */
  public async create(options: CreatePrivatePaymentOptions): Promise<PrivatePayment> {
    const { idempotencyKey, ...body } = options;
    const data = await this.rest.post<PrivatePaymentData>(this.route, {
      body: { ...body, ...(idempotencyKey ? { idempotencyKey } : {}) },
      ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    });
    return this._add(new PrivatePayment(this.client, data));
  }

  /** List the private payments on the key's network, newest first. */
  public async list(options: ListPrivatePaymentsOptions = {}): Promise<PrivatePaymentPage> {
    const data = await this.rest.get<PrivatePaymentListData>(this.route, {
      query: { status: options.status, take: options.take, skip: options.skip },
    });
    return {
      items: data.data.map((d) => this._add(new PrivatePayment(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /** Get one of your private payments, with the transfers that settled it. */
  public async fetch(id: string): Promise<PrivatePayment> {
    const data = await this.rest.get<PrivatePaymentData>(`${this.route}/${pathSegment(id)}`);
    return this._add(new PrivatePayment(this.client, data));
  }

  /**
   * The private payments setup of the key's network: the token, registries,
   * auditor id, commission and fee account a wallet registers and pays against.
   * `enabled` is false where private payments do not run yet.
   */
  public config(): Promise<PrivatePaymentsConfigData> {
    return this.rest.get<PrivatePaymentsConfigData>(`${this.route}/config`);
  }
}
