import { CrossChainSwap } from '@/structures/CrossChainSwap';
import type {
  CreateCrossChainSwapOptions,
  CrossChainAssetData,
  CrossChainQuoteData,
  CrossChainSwapData,
  CrossChainSwapListData,
  ListCrossChainSwapsOptions,
  QuoteCrossChainSwapOptions,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

/** A page of cross-chain swaps plus its pagination metadata. */
export interface CrossChainSwapPage {
  items: CrossChainSwap[];
  total: number;
  take: number;
  skip: number;
}

/**
 * Swaps between Stellar, Solana and Monad, settled by NEAR Intents —
 * `client.crossChainSwaps`. Mainnet only: a `dev` key can list assets and
 * quote, but creating answers `400 network_unsupported`. Both legs on one chain
 * is `client.swaps` with `chain`.
 *
 * @example
 * const swap = await client.crossChainSwaps.create({
 *   originChain: 'stellar', originAsset: 'XLM', amount: '100',
 *   destinationChain: 'solana', destinationAsset: 'USDC',
 *   recipient: solanaAddress, refundTo: stellarAddress,
 * });
 * // Pay swap.amountIn to swap.depositAddress (memo swap.depositMemo), or open swap.depositUri.
 */
export class CrossChainSwapManager extends BaseManager<CrossChainSwap> {
  private readonly route = '/cross-chain-swaps';

  /** The tokens NEAR Intents can swap on Stellar, Solana and Monad. */
  public async assets(): Promise<CrossChainAssetData[]> {
    const { data } = await this.rest.get<{ data: CrossChainAssetData[] }>(
      `${this.route}/assets`,
    );
    return data;
  }

  /** A dry quote: output, minimum and commission. Persists nothing. */
  public quote(options: QuoteCrossChainSwapOptions): Promise<CrossChainQuoteData> {
    return this.rest.post<CrossChainQuoteData>(`${this.route}/quote`, {
      body: options,
    });
  }

  /** A live quote: the deposit address, memo and wallet link that fund the swap. */
  public async create(options: CreateCrossChainSwapOptions): Promise<CrossChainSwap> {
    const data = await this.rest.post<CrossChainSwapData>(this.route, {
      body: options,
    });
    return this._add(new CrossChainSwap(this.client, data));
  }

  public async fetch(id: string): Promise<CrossChainSwap> {
    const data = await this.rest.get<CrossChainSwapData>(`${this.route}/${id}`);
    return this._add(new CrossChainSwap(this.client, data));
  }

  public async list(options: ListCrossChainSwapsOptions = {}): Promise<CrossChainSwapPage> {
    const data = await this.rest.get<CrossChainSwapListData>(this.route, {
      query: { status: options.status, take: options.take, skip: options.skip },
    });
    return {
      items: data.data.map((d) => this._add(new CrossChainSwap(this.client, d))),
      total: data.total,
      take: data.take,
      skip: data.skip,
    };
  }

  /** Report the transaction that paid the deposit address. */
  public async reportDeposit(id: string, txHash: string): Promise<CrossChainSwap> {
    const data = await this.rest.post<CrossChainSwapData>(
      `${this.route}/${id}/deposit`,
      { body: { txHash } },
    );
    return this._add(new CrossChainSwap(this.client, data));
  }
}
