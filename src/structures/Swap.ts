import type { Client } from '@/client/Client';
import {
  SwapStatus,
  type SubmitSwapOptions,
  type SwapData,
} from '@/types/index';
import { Base } from '@/structures/Base';
import type { SwapSubmitOutcome } from '@/managers/SwapManager';

/**
 * A Stellar path-payment swap.
 *
 * Wraps the raw API payload with typed accessors and atomic action methods so
 * you can operate on it directly: `await swap.fetch()`,
 * `await swap.submit({ signedXdr })`.
 */
export class Swap extends Base<SwapData> {
  public status!: SwapStatus;
  public network!: string;
  /** Account performing the swap. */
  public source!: string;
  /** Account that receives the swapped asset. */
  public destination!: string;
  /** Asset code being sent, or `native` for XLM. */
  public sendAsset!: string;
  public sendAssetIssuer!: string | null;
  public sendAmount!: string;
  public feeAmount!: string;
  public feeBps!: number;
  /** Amount swapped after the fee is deducted. */
  public swapAmount!: string;
  /** Asset code being received, or `native` for XLM. */
  public destAsset!: string;
  public destAssetIssuer!: string | null;
  public destEstimated!: string;
  public destMin!: string;
  public slippageBps!: number;
  public path!: { code: string; issuer: string | null }[];
  public memo!: string | null;
  /** Unsigned transaction envelope (base64 XDR). */
  public xdr!: string;
  /** SEP-7 deep link. */
  public uri!: string;
  public txHash!: string;
  /** QR code of the SEP-7 URI (PNG data URL). */
  public qr!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: SwapData) {
    super(client, data);
  }

  protected override _patch(data: SwapData): this {
    super._patch(data);
    this.status = data.status;
    this.network = data.network;
    this.source = data.source;
    this.destination = data.destination;
    this.sendAsset = data.sendAsset;
    this.sendAssetIssuer = data.sendAssetIssuer;
    this.sendAmount = data.sendAmount;
    this.feeAmount = data.feeAmount;
    this.feeBps = data.feeBps;
    this.swapAmount = data.swapAmount;
    this.destAsset = data.destAsset;
    this.destAssetIssuer = data.destAssetIssuer;
    this.destEstimated = data.destEstimated;
    this.destMin = data.destMin;
    this.slippageBps = data.slippageBps;
    this.path = data.path;
    this.memo = data.memo;
    this.xdr = data.xdr;
    this.uri = data.uri;
    this.txHash = data.txHash;
    this.qr = data.qr;
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

  /** Human-readable send asset label (`XLM` for native). */
  public get sendAssetLabel(): string {
    return !this.sendAsset || this.sendAsset === 'native' ? 'XLM' : this.sendAsset;
  }

  /** Human-readable destination asset label (`XLM` for native). */
  public get destAssetLabel(): string {
    return !this.destAsset || this.destAsset === 'native' ? 'XLM' : this.destAsset;
  }

  /** Re-fetch this swap from the API, returning a fresh instance. */
  public fetch(): Promise<Swap> {
    return this.client.swaps.fetch(this.id);
  }

  /**
   * Relay the signed transaction for this swap. Mutates this instance from the
   * refreshed swap in the outcome and returns the outcome.
   */
  public async submit(options: SubmitSwapOptions): Promise<SwapSubmitOutcome> {
    const outcome = await this.client.swaps.submit(this.id, options);
    this._patch(outcome.swap.toJSON());
    return outcome;
  }

  public toJSON(): SwapData {
    return {
      id: this.id,
      status: this.status,
      network: this.network,
      source: this.source,
      destination: this.destination,
      sendAsset: this.sendAsset,
      sendAssetIssuer: this.sendAssetIssuer,
      sendAmount: this.sendAmount,
      feeAmount: this.feeAmount,
      feeBps: this.feeBps,
      swapAmount: this.swapAmount,
      destAsset: this.destAsset,
      destAssetIssuer: this.destAssetIssuer,
      destEstimated: this.destEstimated,
      destMin: this.destMin,
      slippageBps: this.slippageBps,
      path: this.path,
      memo: this.memo,
      xdr: this.xdr,
      uri: this.uri,
      txHash: this.txHash,
      qr: this.qr,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
