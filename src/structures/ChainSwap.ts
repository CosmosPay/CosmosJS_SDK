import type { Client } from '@/client/Client';
import {
  SwapStatus,
  type ChainSwapData,
  type ChainSwapTransaction,
  type EvmCallData,
  type OtherSwapChain,
} from '@/types/index';
import { Base } from '@/structures/Base';
import type { ChainSwapSubmitOutcome } from '@/managers/SwapManager';

/**
 * A same-chain swap on Solana (built by Jupiter) or Monad (built by Kuru Flow),
 * from `client.swaps` with `chain: 'solana' | 'monad'`.
 *
 * Non-custodial like a Stellar {@link Swap}: sign {@link transaction} in the
 * wallet that owns {@link source}, then `await swap.submit({ signedTransaction })`.
 * The server checks it is the transaction it built before broadcasting it. On
 * Monad, when {@link approval} is set, send and confirm that `approve` call first.
 */
export class ChainSwap extends Base<ChainSwapData> {
  public chain!: OtherSwapChain;
  public network!: string;
  /** The aggregator that built it. */
  public provider!: 'jupiter' | 'kuru';
  public status!: SwapStatus;
  /** The wallet that signs, pays and receives. */
  public source!: string;
  /** `native`, or the SPL mint / ERC-20 address. */
  public sendAsset!: string;
  public sendAmount!: string;
  public destAsset!: string;
  public destEstimated!: string;
  public destMin!: string;
  public feeBps!: number;
  /** The commission, in the destination asset. */
  public feeAmount!: string;
  public slippageBps!: number;
  public path!: { code: string; issuer: string | null }[];
  /** What the wallet signs. */
  public transaction!: ChainSwapTransaction;
  /** Monad ERC-20 sales with a short allowance: the `approve` call to send first. */
  public approval!: EvmCallData | null;
  public txHash!: string | null;
  public idempotencyKey!: string | null;
  /** Submit refuses the transaction after this. */
  public expiresAt!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: ChainSwapData) {
    super(client, data);
  }

  protected override _patch(data: ChainSwapData): this {
    super._patch(data);
    this.chain = data.chain;
    this.network = data.network;
    this.provider = data.provider;
    this.status = data.status;
    this.source = data.source;
    this.sendAsset = data.sendAsset;
    this.sendAmount = data.sendAmount;
    this.destAsset = data.destAsset;
    this.destEstimated = data.destEstimated;
    this.destMin = data.destMin;
    this.feeBps = data.feeBps;
    this.feeAmount = data.feeAmount;
    this.slippageBps = data.slippageBps;
    this.path = data.path;
    this.transaction = data.transaction;
    this.approval = data.approval;
    this.txHash = data.txHash;
    this.idempotencyKey = data.idempotencyKey;
    this.expiresAt = new Date(data.expiresAt);
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** Whether the swap has settled on-chain. */
  public get isSucceeded(): boolean {
    return this.status === SwapStatus.Succeeded;
  }

  /** Whether the swap is still awaiting submission. */
  public get isPending(): boolean {
    return this.status === SwapStatus.Pending;
  }

  /** Whether the built transaction can no longer be submitted. */
  public get isStale(): boolean {
    return this.isPending && this.expiresAt.getTime() <= Date.now();
  }

  /** Re-fetch this swap from the API. */
  public async fetch(): Promise<ChainSwap> {
    return (await this.client.swaps.fetch(this.id)) as ChainSwap;
  }

  /**
   * Relay the signed transaction. Mutates this instance from the refreshed
   * swap in the outcome and returns the outcome.
   */
  public async submit(options: {
    signedTransaction: string;
  }): Promise<ChainSwapSubmitOutcome> {
    const outcome = (await this.client.swaps.submit(
      this.id,
      options,
    )) as ChainSwapSubmitOutcome;
    this._patch(outcome.swap.toJSON());
    return outcome;
  }

  public toJSON(): ChainSwapData {
    return {
      id: this.id,
      chain: this.chain,
      network: this.network,
      provider: this.provider,
      status: this.status,
      source: this.source,
      sendAsset: this.sendAsset,
      sendAmount: this.sendAmount,
      destAsset: this.destAsset,
      destEstimated: this.destEstimated,
      destMin: this.destMin,
      feeBps: this.feeBps,
      feeAmount: this.feeAmount,
      slippageBps: this.slippageBps,
      path: this.path,
      transaction: this.transaction,
      approval: this.approval,
      txHash: this.txHash,
      idempotencyKey: this.idempotencyKey,
      expiresAt: this.expiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
