import { PaymentIntent } from '@/structures/PaymentIntent';
import type {
  CreatePayPaymentIntentOptions,
  CreateTxPaymentIntentOptions,
  DeletedData,
  ListPaymentIntentsOptions,
  PaymentIntentData,
  PaymentIntentListData,
  UpdatePaymentIntentOptions,
  ValidatePaymentIntentOptions,
  ValidationOutcomeData,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';
import { resolveIntentBody } from '@/common/intent-input';

/** A page of payment intents plus its pagination metadata. */
export interface PaymentIntentPage {
  items: PaymentIntent[];
  total: number;
  take: number;
  skip: number;
}

/** Validation outcome with the (optional) refreshed intent materialized. */
export interface ValidationOutcome {
  valid: boolean;
  status: ValidationOutcomeData['status'];
  reason: string | null;
  paymentIntent: PaymentIntent | null;
}

/**
 * Manages Stellar payment intents — `client.paymentIntents`.
 *
 * @example
 * const intent = await client.paymentIntents.createTx({
 *   source: 'G...', destination: 'G...', amount: '25.5',
 * });
 * console.log(intent.uri, intent.qr);
 */
export class PaymentIntentManager extends BaseManager<PaymentIntent> {
  private readonly route = '/payment-intents';

  /** Create a SEP-7 `tx` intent (source known → unsigned XDR + tx URI + QR). */
  public async createTx(
    options: CreateTxPaymentIntentOptions,
  ): Promise<PaymentIntent> {
    const data = await this.rest.post<PaymentIntentData>(`${this.route}/tx`, {
      body: resolveIntentBody(options),
    });
    return this._add(new PaymentIntent(this.client, data));
  }

  /** Create a SEP-7 `pay` intent (no source → pay URI + QR, no XDR). */
  public async createPay(
    options: CreatePayPaymentIntentOptions,
  ): Promise<PaymentIntent> {
    const data = await this.rest.post<PaymentIntentData>(`${this.route}/pay`, {
      body: resolveIntentBody(options),
    });
    return this._add(new PaymentIntent(this.client, data));
  }

  /** Get a single payment intent by id. */
  public async fetch(id: string): Promise<PaymentIntent> {
    const data = await this.rest.get<PaymentIntentData>(`${this.route}/${id}`);
    return this._add(new PaymentIntent(this.client, data));
  }

  /** List the consumer's payment intents (paginated). */
  public async list(
    options: ListPaymentIntentsOptions = {},
  ): Promise<PaymentIntentPage> {
    const data = await this.rest.get<PaymentIntentListData>(this.route, {
      query: {
        status: options.status,
        take: options.take,
        skip: options.skip,
      },
    });
    return {
      items: data.data.map((d) => this._add(new PaymentIntent(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /** Update a payment intent (status / txHash / reference). */
  public async update(
    id: string,
    options: UpdatePaymentIntentOptions,
  ): Promise<PaymentIntent> {
    const data = await this.rest.patch<PaymentIntentData>(`${this.route}/${id}`, {
      body: options,
    });
    return this._add(new PaymentIntent(this.client, data));
  }

  /** Delete a payment intent. */
  public async delete(id: string): Promise<DeletedData> {
    const result = await this.rest.delete<DeletedData>(`${this.route}/${id}`);
    this.cache.delete(id);
    return result;
  }

  /**
   * Validate a submitted transaction against the intent (tx success +
   * destination + amount + memo). Finalizes status server-side and fires events.
   */
  public async validate(
    id: string,
    options: ValidatePaymentIntentOptions,
  ): Promise<ValidationOutcome> {
    const data = await this.rest.post<ValidationOutcomeData>(
      `${this.route}/${id}/validate`,
      { body: options },
    );
    const paymentIntent = data.paymentIntent
      ? this._add(new PaymentIntent(this.client, data.paymentIntent))
      : null;
    return {
      valid: data.valid,
      status: data.status,
      reason: data.reason ?? null,
      paymentIntent,
    };
  }
}
