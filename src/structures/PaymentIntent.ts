import type { Client } from '@/client/Client';
import {
  PaymentIntentKind,
  PaymentIntentStatus,
  type PaymentIntentData,
  type UpdatePaymentIntentOptions,
} from '@/types/index';
import { Base } from '@/structures/Base';

/**
 * A Stellar SEP-7 payment intent.
 *
 * Wraps the raw API payload with typed accessors and atomic action methods so
 * you can operate on it directly: `await intent.validate(txHash)`,
 * `await intent.cancel()`, `await intent.delete()`.
 */
export class PaymentIntent extends Base<PaymentIntentData> {
  public kind!: PaymentIntentKind;
  public status!: PaymentIntentStatus;
  public network!: string;
  /** Payer account (null for PAY intents). */
  public source!: string | null;
  public destination!: string;
  public amount!: string | null;
  /** Asset code, or `native` for XLM. */
  public asset!: string;
  public assetIssuer!: string | null;
  /** Mandatory MEMO_ID. */
  public memo!: string;
  public msg!: string | null;
  public callback!: string | null;
  /** Unsigned transaction envelope (base64 XDR); null for PAY intents. */
  public xdr!: string | null;
  /** SEP-7 deep link (`tx` or `pay`). */
  public uri!: string;
  /** QR code of the SEP-7 URI (PNG data URL). */
  public qr!: string;
  public txHash!: string | null;
  public reference!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: PaymentIntentData) {
    super(client, data);
  }

  protected override _patch(data: PaymentIntentData): this {
    super._patch(data);
    this.kind = data.kind;
    this.status = data.status;
    this.network = data.network;
    this.source = data.source;
    this.destination = data.destination;
    this.amount = data.amount;
    this.asset = data.asset;
    this.assetIssuer = data.assetIssuer;
    this.memo = data.memo;
    this.msg = data.msg;
    this.callback = data.callback;
    this.xdr = data.xdr;
    this.uri = data.uri;
    this.qr = data.qr;
    this.txHash = data.txHash;
    this.reference = data.reference;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** Whether this is a SEP-7 `tx` intent (known source, has XDR). */
  public get isTx(): boolean {
    return this.kind === PaymentIntentKind.Tx;
  }

  /** Whether this is a SEP-7 `pay` intent (no source). */
  public get isPay(): boolean {
    return this.kind === PaymentIntentKind.Pay;
  }

  /** Whether the payment has settled on-chain. */
  public get isSucceeded(): boolean {
    return this.status === PaymentIntentStatus.Succeeded;
  }

  /** Whether the intent is still awaiting payment. */
  public get isPending(): boolean {
    return this.status === PaymentIntentStatus.Pending;
  }

  /** Human-readable asset label (`XLM` for native). */
  public get assetLabel(): string {
    return !this.asset || this.asset === 'native' ? 'XLM' : this.asset;
  }

  /** Re-fetch this intent from the API, returning a fresh instance. */
  public fetch(): Promise<PaymentIntent> {
    return this.client.paymentIntents.fetch(this.id);
  }

  /** Update this intent (status / txHash / reference). Mutates and returns it. */
  public async edit(options: UpdatePaymentIntentOptions): Promise<this> {
    const updated = await this.client.paymentIntents.update(this.id, options);
    return this._patch(updated.toJSON());
  }

  /**
   * Validate a submitted transaction against this intent. On a match the status
   * is finalized server-side and the webhook fires.
   */
  public validate(txHash: string) {
    return this.client.paymentIntents.validate(this.id, { txHash });
  }

  /** Mark this intent as cancelled. */
  public cancel(): Promise<this> {
    return this.edit({ status: PaymentIntentStatus.Cancelled });
  }

  /** Delete this intent. */
  public delete() {
    return this.client.paymentIntents.delete(this.id);
  }

  public toJSON(): PaymentIntentData {
    return {
      id: this.id,
      kind: this.kind,
      status: this.status,
      network: this.network,
      source: this.source,
      destination: this.destination,
      amount: this.amount,
      asset: this.asset,
      assetIssuer: this.assetIssuer,
      memo: this.memo,
      msg: this.msg,
      callback: this.callback,
      xdr: this.xdr,
      uri: this.uri,
      qr: this.qr,
      txHash: this.txHash,
      reference: this.reference,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
