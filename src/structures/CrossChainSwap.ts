import type { Client } from '@/client/Client';
import {
  CrossChainSwapStatus,
  type CrossChainSwapData,
  type CrossChainTransactionData,
  type SwapChain,
} from '@/types/index';
import { Base } from '@/structures/Base';

/** Statuses after which nothing changes. */
const FINAL: readonly CrossChainSwapStatus[] = [
  CrossChainSwapStatus.Succeeded,
  CrossChainSwapStatus.Refunded,
  CrossChainSwapStatus.Failed,
];

/**
 * A swap between two chains, settled by NEAR Intents — `client.crossChainSwaps`.
 *
 * Pay exactly {@link amountIn} of the origin asset to {@link depositAddress}
 * (with {@link depositMemo} on Stellar, as a MEMO_TEXT) — {@link depositUri} is
 * that payment as a wallet link. NEAR Intents pays {@link recipient} on the
 * destination chain, or refunds {@link refundTo}. The server follows it; poll
 * with `await swap.fetch()` or subscribe to the `CROSS_CHAIN_SWAP_*` webhooks.
 */
export class CrossChainSwap extends Base<CrossChainSwapData> {
  public status!: CrossChainSwapStatus;
  /** NEAR Intents' own status word. */
  public providerStatus!: string;
  public network!: string;
  public originChain!: SwapChain;
  public originAsset!: string;
  public originContract!: string | null;
  public destinationChain!: SwapChain;
  public destinationAsset!: string;
  public destinationContract!: string | null;
  public amountIn!: string;
  public feeBps!: number;
  public feeAmount!: string;
  public amountOutEstimated!: string;
  public amountOutMin!: string;
  public slippageBps!: number;
  public recipient!: string;
  public refundTo!: string;
  public depositAddress!: string;
  public depositMemo!: string | null;
  public depositUri!: string;
  /** QR of {@link depositUri}; list rows do not carry it. */
  public qr!: string | null;
  public depositTxHash!: string | null;
  public amountOut!: string | null;
  public refundedAmount!: string | null;
  public originTxHashes!: CrossChainTransactionData[] | null;
  public destinationTxHashes!: CrossChainTransactionData[] | null;
  public timeEstimateSeconds!: number;
  public correlationId!: string;
  /** Keep it: NEAR Intents' signature over the quote settles a dispute. */
  public quoteSignature!: string;
  public idempotencyKey!: string | null;
  public expiresAt!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: CrossChainSwapData) {
    super(client, data);
  }

  protected override _patch(data: CrossChainSwapData): this {
    super._patch(data);
    this.status = data.status;
    this.providerStatus = data.providerStatus;
    this.network = data.network;
    this.originChain = data.originChain;
    this.originAsset = data.originAsset;
    this.originContract = data.originContract;
    this.destinationChain = data.destinationChain;
    this.destinationAsset = data.destinationAsset;
    this.destinationContract = data.destinationContract;
    this.amountIn = data.amountIn;
    this.feeBps = data.feeBps;
    this.feeAmount = data.feeAmount;
    this.amountOutEstimated = data.amountOutEstimated;
    this.amountOutMin = data.amountOutMin;
    this.slippageBps = data.slippageBps;
    this.recipient = data.recipient;
    this.refundTo = data.refundTo;
    this.depositAddress = data.depositAddress;
    this.depositMemo = data.depositMemo;
    this.depositUri = data.depositUri;
    this.qr = data.qr ?? null;
    this.depositTxHash = data.depositTxHash;
    this.amountOut = data.amountOut;
    this.refundedAmount = data.refundedAmount;
    this.originTxHashes = data.originTxHashes;
    this.destinationTxHashes = data.destinationTxHashes;
    this.timeEstimateSeconds = data.timeEstimateSeconds;
    this.correlationId = data.correlationId;
    this.quoteSignature = data.quoteSignature;
    this.idempotencyKey = data.idempotencyKey;
    this.expiresAt = new Date(data.expiresAt);
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** Whether the swap has reached an outcome that will not change. */
  public get isFinal(): boolean {
    return FINAL.includes(this.status);
  }

  public get isSucceeded(): boolean {
    return this.status === CrossChainSwapStatus.Succeeded;
  }

  /** Re-fetch from the API, updating this instance in place. */
  public async fetch(): Promise<this> {
    const fresh = await this.client.crossChainSwaps.fetch(this.id);
    return this._patch(fresh.toJSON());
  }

  /**
   * Report the transaction that paid the deposit address so NEAR Intents starts
   * without waiting for its indexer. Updates this instance in place.
   */
  public async reportDeposit(txHash: string): Promise<this> {
    const fresh = await this.client.crossChainSwaps.reportDeposit(this.id, txHash);
    return this._patch(fresh.toJSON());
  }

  public toJSON(): CrossChainSwapData {
    return {
      id: this.id,
      status: this.status,
      providerStatus: this.providerStatus,
      network: this.network,
      originChain: this.originChain,
      originAsset: this.originAsset,
      originContract: this.originContract,
      destinationChain: this.destinationChain,
      destinationAsset: this.destinationAsset,
      destinationContract: this.destinationContract,
      amountIn: this.amountIn,
      feeBps: this.feeBps,
      feeAmount: this.feeAmount,
      amountOutEstimated: this.amountOutEstimated,
      amountOutMin: this.amountOutMin,
      slippageBps: this.slippageBps,
      recipient: this.recipient,
      refundTo: this.refundTo,
      depositAddress: this.depositAddress,
      depositMemo: this.depositMemo,
      depositUri: this.depositUri,
      ...(this.qr ? { qr: this.qr } : {}),
      depositTxHash: this.depositTxHash,
      amountOut: this.amountOut,
      refundedAmount: this.refundedAmount,
      originTxHashes: this.originTxHashes,
      destinationTxHashes: this.destinationTxHashes,
      timeEstimateSeconds: this.timeEstimateSeconds,
      correlationId: this.correlationId,
      quoteSignature: this.quoteSignature,
      idempotencyKey: this.idempotencyKey,
      expiresAt: this.expiresAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
