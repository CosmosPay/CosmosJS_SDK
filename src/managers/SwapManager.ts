import { Swap } from '@/structures/Swap';
import type {
  CreateSwapOptions,
  ListSwapsOptions,
  QuoteSwapOptions,
  SubmitSwapOptions,
  SwapData,
  SwapListData,
  SwapQuoteData,
  SwapStatus,
  SwapSubmitOutcomeData,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

/** A page of swaps plus its pagination metadata. */
export interface SwapPage {
  items: Swap[];
  total: number;
  take: number;
  skip: number;
}

/** Submission outcome with the refreshed swap materialized. */
export interface SwapSubmitOutcome {
  submitted: boolean;
  status: SwapStatus;
  txHash: string | null;
  reason: string | null;
  resultCodes: string[] | null;
  swap: Swap;
}

/**
 * Manages Stellar swaps — `client.swaps`.
 *
 * @example
 * const quote = await client.swaps.quote({
 *   amount: '100', destAssetCode: 'USDC',
 * });
 * const swap = await client.swaps.create({
 *   amount: '100', destAssetCode: 'USDC', source: 'G...',
 * });
 * console.log(swap.uri, swap.qr);
 */
export class SwapManager extends BaseManager<Swap> {
  private readonly route = '/swaps';

  /** Price a swap without creating it. Returns a plain quote (not a {@link Swap}). */
  public async quote(options: QuoteSwapOptions): Promise<SwapQuoteData> {
    return this.rest.post<SwapQuoteData>(`${this.route}/quote`, {
      body: options,
    });
  }

  /** Create a swap (unsigned XDR + SEP-7 URI + QR). */
  public async create(options: CreateSwapOptions): Promise<Swap> {
    const data = await this.rest.post<SwapData>(this.route, { body: options });
    return this._add(new Swap(this.client, data));
  }

  /** Get a single swap by id. */
  public async fetch(id: string): Promise<Swap> {
    const data = await this.rest.get<SwapData>(`${this.route}/${id}`);
    return this._add(new Swap(this.client, data));
  }

  /** List the consumer's swaps (paginated). */
  public async list(options: ListSwapsOptions = {}): Promise<SwapPage> {
    const data = await this.rest.get<SwapListData>(this.route, {
      query: {
        status: options.status,
        take: options.take,
        skip: options.skip,
      },
    });
    return {
      items: data.data.map((d) => this._add(new Swap(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /**
   * Relay a signed swap transaction to the network. Finalizes status
   * server-side and returns the outcome with the refreshed swap materialized.
   */
  public async submit(
    id: string,
    options: SubmitSwapOptions,
  ): Promise<SwapSubmitOutcome> {
    const data = await this.rest.post<SwapSubmitOutcomeData>(
      `${this.route}/${id}/submit`,
      { body: options },
    );
    return {
      submitted: data.submitted,
      status: data.status,
      txHash: data.txHash ?? null,
      reason: data.reason ?? null,
      resultCodes: data.resultCodes ?? null,
      swap: this._add(new Swap(this.client, data.swap)),
    };
  }
}
