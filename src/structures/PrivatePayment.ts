import type { Client } from '@/client/Client';
import {
  PrivatePaymentStatus,
  type MerchantFeeData,
  type PrivatePaymentData,
  type PrivatePaymentNetwork,
} from '@/types/index';
import { Base } from '@/structures/Base';

/**
 * A private payment, from `client.privatePayments`: an amount in XLM whose value
 * is hidden on-chain. The payer pays it with confidential transfers on Cosmos
 * Pay's confidential token (net to {@link recipient}, the commission to
 * {@link feeAccount}, and a third one when there is a {@link merchantFee}) and
 * confirms them through the private checkout. Poll with `await payment.fetch()`.
 */
export class PrivatePayment extends Base<PrivatePaymentData> {
  /** As it reads now: a PENDING payment past {@link expiresAt} reads EXPIRED. */
  public status!: PrivatePaymentStatus;
  public network!: PrivatePaymentNetwork;
  /** The confidential token every transfer must be made on. */
  public tokenContract!: string;
  /** What the payer pays in total, in XLM. */
  public amount!: string;
  /** What the merchant receives, in XLM. */
  public netAmount!: string;
  /** The commission, in XLM. */
  public feeAmount!: string;
  /** The commission rate the payment was priced at, in basis points. */
  public feeBps!: number;
  /** The merchant (G...). */
  public recipient!: string;
  /** Cosmos Pay's account the commission is paid to. */
  public feeAccount!: string;
  /** The account the transfers came from, once settled. */
  public payer!: string | null;
  public paymentTxHash!: string | null;
  public feeTxHash!: string | null;
  public merchantFee!: MerchantFeeData | null;
  public merchantFeeTxHash!: string | null;
  public description!: string | null;
  public idempotencyKey!: string;
  /** Every transfer must close before this. */
  public expiresAt!: Date;
  public settledAt!: Date | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: PrivatePaymentData) {
    super(client, data);
  }

  protected override _patch(data: PrivatePaymentData): this {
    super._patch(data);
    this.status = data.status;
    this.network = data.network;
    this.tokenContract = data.tokenContract;
    this.amount = data.amount;
    this.netAmount = data.netAmount;
    this.feeAmount = data.feeAmount;
    this.feeBps = data.feeBps;
    this.recipient = data.recipient;
    this.feeAccount = data.feeAccount;
    this.payer = data.payer;
    this.paymentTxHash = data.paymentTxHash;
    this.feeTxHash = data.feeTxHash;
    this.merchantFee = data.merchantFee;
    this.merchantFeeTxHash = data.merchantFeeTxHash;
    this.description = data.description;
    this.idempotencyKey = data.idempotencyKey;
    this.expiresAt = new Date(data.expiresAt);
    this.settledAt = data.settledAt ? new Date(data.settledAt) : null;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** Whether the payment is still waiting for its transfers. */
  public get isPending(): boolean {
    return this.status === PrivatePaymentStatus.Pending;
  }

  /** Whether every transfer has been confirmed. */
  public get isSucceeded(): boolean {
    return this.status === PrivatePaymentStatus.Succeeded;
  }

  /** Whether it passed {@link expiresAt} without settling (it can still settle with transfers that closed in time). */
  public get isExpired(): boolean {
    return this.status === PrivatePaymentStatus.Expired;
  }

  /** Re-fetch from the API, updating this instance in place. */
  public async fetch(): Promise<this> {
    const fresh = await this.client.privatePayments.fetch(this.id);
    return this._patch(fresh.toJSON());
  }

  public toJSON(): PrivatePaymentData {
    return {
      id: this.id,
      status: this.status,
      network: this.network,
      tokenContract: this.tokenContract,
      amount: this.amount,
      netAmount: this.netAmount,
      feeAmount: this.feeAmount,
      feeBps: this.feeBps,
      recipient: this.recipient,
      feeAccount: this.feeAccount,
      payer: this.payer,
      paymentTxHash: this.paymentTxHash,
      feeTxHash: this.feeTxHash,
      merchantFee: this.merchantFee,
      merchantFeeTxHash: this.merchantFeeTxHash,
      description: this.description,
      idempotencyKey: this.idempotencyKey,
      expiresAt: this.expiresAt.toISOString(),
      settledAt: this.settledAt ? this.settledAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
