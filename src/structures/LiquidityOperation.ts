import type { Client } from '@/client/Client';
import {
  LiquidityOperationKind,
  LiquidityOperationStatus,
  type LiquidityOperationData,
  type SubmitLiquidityOptions,
} from '@/types/index';
import { Base } from '@/structures/Base';
import type { LiquiditySubmitOutcome } from '@/managers/LiquidityManager';

/**
 * One deposit into, or withdrawal from, a Stellar liquidity pool.
 *
 * The server builds the envelope and the wallet signs it, so an operation is a
 * two-step object: it arrives `PENDING` carrying an unsigned `xdr`, and reaches
 * `SUBMITTED`/`SUCCEEDED` only once the signed envelope comes back through
 * `submit()`. Both steps are available on the instance —
 * `await operation.submit({ signedXdr })` — so a caller never has to keep the id
 * and the manager in scope alongside it.
 */
export class LiquidityOperation extends Base<LiquidityOperationData> {
  /** Deposit or withdrawal. */
  public kind!: LiquidityOperationKind;
  public status!: LiquidityOperationStatus;
  public network!: string;
  /** Account whose funds move, and which must sign. */
  public source!: string;
  /** The pool this operation acts on (hex id). */
  public poolId!: string;
  public assetA!: string;
  public assetAIssuer!: string | null;
  public assetB!: string;
  public assetBIssuer!: string | null;
  /** Maximum of asset A put in (deposit), or minimum taken out (withdrawal). */
  public amountA!: string;
  public amountB!: string;
  /** Pool shares minted or burned; null until the network settles a deposit. */
  public shares!: string | null;
  /** Price band a deposit executes within, as decimal strings. */
  public minPrice!: string | null;
  public maxPrice!: string | null;
  public slippageBps!: number;
  public idempotencyKey!: string | null;
  public feeBps!: number;
  public feeAmountA!: string;
  public feeAmountB!: string;
  public feeWallet!: string | null;
  public commissionMemo!: string | null;
  /** Unsigned transaction envelope (base64 XDR) — what the wallet signs. */
  public xdr!: string;
  /** SEP-7 `web+stellar:tx` deep link for the same envelope. */
  public uri!: string;
  public txHash!: string;
  /** QR code of the SEP-7 URI (PNG data URL). */
  public qr!: string;
  /** When the built envelope stops being submittable. */
  public expiresAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: LiquidityOperationData) {
    super(client, data);
  }

  protected override _patch(data: LiquidityOperationData): this {
    super._patch(data);
    this.kind = data.kind;
    this.status = data.status;
    this.network = data.network;
    this.source = data.source;
    this.poolId = data.poolId;
    this.assetA = data.assetA;
    this.assetAIssuer = data.assetAIssuer ?? null;
    this.assetB = data.assetB;
    this.assetBIssuer = data.assetBIssuer ?? null;
    this.amountA = data.amountA;
    this.amountB = data.amountB;
    this.shares = data.shares ?? null;
    this.minPrice = data.minPrice ?? null;
    this.maxPrice = data.maxPrice ?? null;
    this.slippageBps = data.slippageBps;
    this.idempotencyKey = data.idempotencyKey ?? null;
    this.feeBps = data.feeBps;
    this.feeAmountA = data.feeAmountA;
    this.feeAmountB = data.feeAmountB;
    this.feeWallet = data.feeWallet ?? null;
    this.commissionMemo = data.commissionMemo ?? null;
    this.xdr = data.xdr;
    this.uri = data.uri;
    this.txHash = data.txHash;
    this.qr = data.qr;
    this.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** True while the envelope still needs a signature. */
  public get isPending(): boolean {
    return this.status === LiquidityOperationStatus.Pending;
  }

  /** True once the network accepted it. */
  public get isSucceeded(): boolean {
    return this.status === LiquidityOperationStatus.Succeeded;
  }

  /** True for a deposit, false for a withdrawal. */
  public get isDeposit(): boolean {
    return this.kind === LiquidityOperationKind.Deposit;
  }

  /** Re-fetch this operation and patch it in place. */
  public async fetch(): Promise<this> {
    const data = await this.client.liquidity.fetchRaw(this.id);
    return this._patch(data);
  }

  /** Relay the signed envelope to the network and patch this instance with the result. */
  public async submit(options: SubmitLiquidityOptions): Promise<LiquiditySubmitOutcome> {
    const outcome = await this.client.liquidity.submit(this.id, options);
    // Patch in place: the caller is holding THIS object, and leaving it showing
    // `PENDING` after a successful submit is the kind of staleness that gets
    // rendered straight into a UI.
    this._patch(outcome.operation.toJSON());
    return outcome;
  }

  public toJSON(): LiquidityOperationData {
    return {
      id: this.id,
      kind: this.kind,
      status: this.status,
      network: this.network,
      source: this.source,
      poolId: this.poolId,
      assetA: this.assetA,
      assetAIssuer: this.assetAIssuer,
      assetB: this.assetB,
      assetBIssuer: this.assetBIssuer,
      amountA: this.amountA,
      amountB: this.amountB,
      shares: this.shares,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      slippageBps: this.slippageBps,
      idempotencyKey: this.idempotencyKey,
      feeBps: this.feeBps,
      feeAmountA: this.feeAmountA,
      feeAmountB: this.feeAmountB,
      feeWallet: this.feeWallet,
      commissionMemo: this.commissionMemo,
      xdr: this.xdr,
      uri: this.uri,
      txHash: this.txHash,
      qr: this.qr,
      expiresAt: this.expiresAt ? this.expiresAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
