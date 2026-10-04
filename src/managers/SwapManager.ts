import { ChainSwap } from '@/structures/ChainSwap';
import { Swap } from '@/structures/Swap';
import type {
  ChainSwapData,
  ChainSwapListData,
  ChainSwapSubmitOutcomeData,
  CreateSwapOptions,
  ListSwapsOptions,
  OtherSwapChain,
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
export interface SwapPage<T extends Swap | ChainSwap = Swap> {
  items: T[];
  total: number;
  take: number;
  skip: number;
}

/** Submission outcome of a Stellar swap, with the refreshed swap materialized. */
export interface SwapSubmitOutcome {
  submitted: boolean;
  status: SwapStatus;
  txHash: string | null;
  reason: string | null;
  resultCodes: string[] | null;
  swap: Swap;
}

/** Submission outcome of a Solana or Monad swap. */
export interface ChainSwapSubmitOutcome {
  submitted: boolean;
  status: SwapStatus;
  txHash: string;
  swap: ChainSwap;
}

/** A request that names a chain off Stellar. */
type OnOtherChain = { chain: OtherSwapChain };

/** A Solana or Monad payload carries its `chain`; a Stellar one never does. */
function isChainSwapData(data: SwapData | ChainSwapData): data is ChainSwapData {
  return 'chain' in data && typeof data.chain === 'string';
}

/**
 * Same-chain swaps — `client.swaps`. No `chain` (or `'stellar'`) is a Stellar
 * path payment and yields a {@link Swap}, exactly as before; `'solana'` goes
 * through Jupiter and `'monad'` through Kuru Flow and yields a {@link ChainSwap}.
 * Swaps between chains are `client.crossChainSwaps`.
 *
 * @example
 * const swap = await client.swaps.create({
 *   amount: '100', destAssetCode: 'USDC', destAssetIssuer: 'GA5Z…', source: 'G...',
 * });
 * console.log(swap.uri, swap.qr);
 *
 * const sol = await client.swaps.create({
 *   chain: 'solana', amount: '0.1', sourceAssetCode: 'SOL',
 *   destAssetCode: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', source: wallet,
 * });
 * await sol.submit({ signedTransaction: signInWallet(sol.transaction) });
 */
export class SwapManager extends BaseManager<Swap | ChainSwap> {
  private readonly route = '/swaps';

  /** Price a swap without creating it. Returns a plain quote (not a {@link Swap}). */
  public async quote(options: QuoteSwapOptions): Promise<SwapQuoteData> {
    return this.rest.post<SwapQuoteData>(`${this.route}/quote`, {
      body: options,
    });
  }

  /** Create a swap: an unsigned transaction for the source wallet to sign. */
  public async create(options: CreateSwapOptions & OnOtherChain): Promise<ChainSwap>;
  public async create(options: CreateSwapOptions): Promise<Swap>;
  public async create(options: CreateSwapOptions): Promise<Swap | ChainSwap> {
    const data = await this.rest.post<SwapData | ChainSwapData>(this.route, {
      body: options,
    });
    return this.materialize(data);
  }

  /** Get a single swap by id, on any chain. */
  public async fetch(id: string): Promise<Swap | ChainSwap> {
    const data = await this.rest.get<SwapData | ChainSwapData>(
      `${this.route}/${id}`,
    );
    return this.materialize(data);
  }

  /** List the consumer's swaps on one chain (Stellar when `chain` is omitted). */
  public async list(options: ListSwapsOptions & OnOtherChain): Promise<SwapPage<ChainSwap>>;
  public async list(options?: ListSwapsOptions): Promise<SwapPage<Swap>>;
  public async list(
    options: ListSwapsOptions = {},
  ): Promise<SwapPage<Swap> | SwapPage<ChainSwap>> {
    const data = await this.rest.get<SwapListData | ChainSwapListData>(
      this.route,
      {
        query: {
          chain: options.chain,
          status: options.status,
          take: options.take,
          skip: options.skip,
        },
      },
    );
    return {
      items: data.data.map((d) => this.materialize(d)),
      total: data.total,
      take: data.take,
      skip: data.skip,
    } as SwapPage<Swap> | SwapPage<ChainSwap>;
  }

  /**
   * Relay a signed swap transaction to its network: `{ signedXdr }` for a
   * Stellar swap, `{ signedTransaction }` for a Solana or Monad one.
   */
  public async submit(
    id: string,
    options: SubmitSwapOptions,
  ): Promise<SwapSubmitOutcome | ChainSwapSubmitOutcome> {
    const data = await this.rest.post<
      SwapSubmitOutcomeData | ChainSwapSubmitOutcomeData
    >(`${this.route}/${id}/submit`, { body: options });
    if (isChainSwapData(data.swap)) {
      return {
        submitted: data.submitted,
        status: data.status,
        txHash: (data as ChainSwapSubmitOutcomeData).txHash,
        swap: this._add(new ChainSwap(this.client, data.swap)) as ChainSwap,
      };
    }
    const stellar = data as SwapSubmitOutcomeData;
    return {
      submitted: stellar.submitted,
      status: stellar.status,
      txHash: stellar.txHash ?? null,
      reason: stellar.reason ?? null,
      resultCodes: stellar.resultCodes ?? null,
      swap: this._add(new Swap(this.client, stellar.swap)) as Swap,
    };
  }

  private materialize(data: SwapData): Swap;
  private materialize(data: ChainSwapData): ChainSwap;
  private materialize(data: SwapData | ChainSwapData): Swap | ChainSwap;
  private materialize(data: SwapData | ChainSwapData): Swap | ChainSwap {
    return this._add(
      isChainSwapData(data)
        ? new ChainSwap(this.client, data)
        : new Swap(this.client, data),
    );
  }
}
