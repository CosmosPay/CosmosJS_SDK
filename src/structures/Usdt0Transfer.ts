import type { Client } from '@/client/Client';
import {
  Usdt0TransferStatus,
  type MerchantFeeData,
  type Usdt0Destination,
  type Usdt0Receives,
  type Usdt0TransferData,
} from '@/types/index';
import { Base } from '@/structures/Base';
import type { Usdt0SubmitOutcome } from '@/managers/Usdt0Manager';

/** Statuses after which nothing changes. */
const FINAL: readonly Usdt0TransferStatus[] = [
  Usdt0TransferStatus.Delivered,
  Usdt0TransferStatus.Failed,
  Usdt0TransferStatus.Expired,
];

/**
 * A USDT0 transfer from Stellar to an EVM network through LayerZero, from
 * `client.usdt0`.
 *
 * Non-custodial like a {@link Swap}: the API builds one Soroban transaction
 * ({@link xdr}, or the SEP-7 {@link uri}), the account that holds the USDT0
 * ({@link source}) signs it, and `await transfer.submit({ signedXdr })` relays it.
 * LayerZero then delivers it (about 27 minutes on every route); follow it with
 * `await transfer.fetch()` until {@link isFinal}.
 */
export class Usdt0Transfer extends Base<Usdt0TransferData> {
  public status!: Usdt0TransferStatus;
  /** Always mainnet (`public`). */
  public network!: string;
  /** The Stellar account that holds the USDT0, signs and pays the fees in XLM. */
  public source!: string;
  public to!: Usdt0Destination;
  /** The destination network's LayerZero endpoint id. */
  public eid!: number;
  public receives!: Usdt0Receives;
  /** The EVM address credited. */
  public recipient!: string;
  public amount!: string;
  public amountSent!: string;
  public amountReceived!: string;
  public dust!: string;
  /** LayerZero's quoted messaging fee, in XLM. */
  public nativeFee!: string;
  /** What the transaction offers LayerZero, in XLM; the unused part is refunded. */
  public nativeFeeLimit!: string;
  /** The Stellar network fee, in XLM. */
  public networkFee!: string;
  public feeBps!: number;
  public feeAmount!: string;
  public feeWallet!: string | null;
  /** The unsigned transaction (base64 XDR) to sign. */
  public xdr!: string;
  /** SEP-7 `tx` link carrying {@link xdr}. */
  public uri!: string;
  /** QR of {@link uri}; usually null (a Soroban transaction is too large for one), and absent from list rows. */
  public qr!: string | null;
  public txHash!: string | null;
  /** LayerZero's message id, once the transaction landed. */
  public guid!: string | null;
  public destinationTxHash!: string | null;
  /** LayerZero Scan's own status word, verbatim. */
  public scanStatus!: string | null;
  public scanUrl!: string | null;
  public failureReason!: string | null;
  public merchantFee!: MerchantFeeData | null;
  public idempotencyKey!: string | null;
  /** Submit refuses the transaction after this. */
  public expiresAt!: Date;
  public submittedAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;
  /**
   * The record's read token, returned by the create only when the client uses the
   * shared public key. Kept across {@link fetch} and {@link submit}, which send it
   * as `X-Record-Token`.
   */
  public publicToken!: string | null;

  constructor(client: Client, data: Usdt0TransferData) {
    super(client, data);
  }

  protected override _patch(data: Usdt0TransferData): this {
    super._patch(data);
    this.status = data.status;
    this.network = data.network;
    this.source = data.source;
    this.to = data.to;
    this.eid = data.eid;
    this.receives = data.receives;
    this.recipient = data.recipient;
    this.amount = data.amount;
    this.amountSent = data.amountSent;
    this.amountReceived = data.amountReceived;
    this.dust = data.dust;
    this.nativeFee = data.nativeFee;
    this.nativeFeeLimit = data.nativeFeeLimit;
    this.networkFee = data.networkFee;
    this.feeBps = data.feeBps;
    this.feeAmount = data.feeAmount;
    this.feeWallet = data.feeWallet;
    this.xdr = data.xdr;
    this.uri = data.uri;
    this.qr = data.qr ?? null;
    this.txHash = data.txHash;
    this.guid = data.guid;
    this.destinationTxHash = data.destinationTxHash;
    this.scanStatus = data.scanStatus;
    this.scanUrl = data.scanUrl;
    this.failureReason = data.failureReason;
    this.merchantFee = data.merchantFee;
    this.idempotencyKey = data.idempotencyKey;
    this.expiresAt = new Date(data.expiresAt);
    this.submittedAt = data.submittedAt ? new Date(data.submittedAt) : null;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    // Only the create carries it: a later read must not erase it.
    this.publicToken = data.publicToken ?? this.publicToken ?? null;
    return this;
  }

  /** Whether the transfer is still waiting for its signature. */
  public get isPending(): boolean {
    return this.status === Usdt0TransferStatus.Pending;
  }

  /** Whether it was credited on the destination network. */
  public get isDelivered(): boolean {
    return this.status === Usdt0TransferStatus.Delivered;
  }

  /** Whether it reached an outcome that will not change (DELIVERED, FAILED or EXPIRED). */
  public get isFinal(): boolean {
    return FINAL.includes(this.status);
  }

  /** Re-read it (the API refreshes it from the ledger and LayerZero Scan), updating this instance in place. */
  public async fetch(): Promise<this> {
    const fresh = await this.client.usdt0.fetch(this.id, this.recordToken());
    return this._patch(fresh.toJSON());
  }

  /**
   * Relay the signed transaction. Mutates this instance from the transfer in the
   * outcome and returns the outcome.
   */
  public async submit(options: { signedXdr: string }): Promise<Usdt0SubmitOutcome> {
    const outcome = await this.client.usdt0.submit(this.id, {
      signedXdr: options.signedXdr,
      ...this.recordToken(),
    });
    this._patch(outcome.transfer.toJSON());
    return outcome;
  }

  private recordToken(): { recordToken?: string } {
    return this.publicToken ? { recordToken: this.publicToken } : {};
  }

  public toJSON(): Usdt0TransferData {
    return {
      id: this.id,
      status: this.status,
      network: this.network,
      source: this.source,
      to: this.to,
      eid: this.eid,
      receives: this.receives,
      recipient: this.recipient,
      amount: this.amount,
      amountSent: this.amountSent,
      amountReceived: this.amountReceived,
      dust: this.dust,
      nativeFee: this.nativeFee,
      nativeFeeLimit: this.nativeFeeLimit,
      networkFee: this.networkFee,
      feeBps: this.feeBps,
      feeAmount: this.feeAmount,
      feeWallet: this.feeWallet,
      xdr: this.xdr,
      uri: this.uri,
      qr: this.qr,
      txHash: this.txHash,
      guid: this.guid,
      destinationTxHash: this.destinationTxHash,
      scanStatus: this.scanStatus,
      scanUrl: this.scanUrl,
      failureReason: this.failureReason,
      merchantFee: this.merchantFee,
      idempotencyKey: this.idempotencyKey,
      expiresAt: this.expiresAt.toISOString(),
      submittedAt: this.submittedAt ? this.submittedAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      ...(this.publicToken ? { publicToken: this.publicToken } : {}),
    };
  }
}
