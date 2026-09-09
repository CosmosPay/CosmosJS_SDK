import type { Client } from '@/client/Client';
import type {
  ApproveReceiverOptions,
  BankAccountData,
  CreateBankAccountOptions,
  CreateReceiverWalletOptions,
  EnableReceiverOptions,
  ListKycOptions,
  ReceiverData,
  ReceiverWalletData,
  RequestTosOptions,
  TermsOfServiceData,
  UpdateReceiverOptions,
} from '@/types/index';
import { Base } from '@/structures/Base';
import type { BankAccountPage, ReceiverWalletPage } from '@/managers/KycManager';

/**
 * A verified identity — the thing both ramps hang off.
 *
 * Everything a receiver owns is reachable from the instance
 * (`receiver.addBankAccount(…)`, `receiver.wallets()`), because the alternative is
 * carrying a receiver id and a manager reference side by side through a KYC flow
 * that already has enough moving parts.
 */
export class Receiver extends Base<ReceiverData> {
  public blindpayId!: string;
  /** `individual` or `business`. */
  public type!: string;
  public kycType!: string | null;
  /** Verification state, refreshed from upstream on every read. */
  public kycStatus!: string | null;
  public email!: string | null;
  public name!: string | null;
  public country!: string | null;
  /** Your own id for this receiver, if you set one. */
  public externalId!: string | null;
  /** True when the receiver is cut off from both ramps. */
  public disabled!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: ReceiverData) {
    super(client, data);
  }

  protected override _patch(data: ReceiverData): this {
    super._patch(data);
    this.blindpayId = data.blindpayId;
    this.type = data.type;
    this.kycType = data.kycType ?? null;
    this.kycStatus = data.kycStatus ?? null;
    this.email = data.email ?? null;
    this.name = data.name ?? null;
    this.country = data.country ?? null;
    this.externalId = data.externalId ?? null;
    this.disabled = data.disabled;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** True once verification has passed and the ramps will act on this receiver. */
  public get isApproved(): boolean {
    return this.kycStatus === 'approved';
  }

  /** Re-read this receiver, refreshing `kycStatus`, and patch it in place. */
  public async fetch(): Promise<this> {
    return this._patch(await this.client.kyc.fetchReceiverRaw(this.id));
  }

  /** Update and patch in place. */
  public async update(options: UpdateReceiverOptions): Promise<this> {
    const updated = await this.client.kyc.updateReceiver(this.id, options);
    return this._patch(updated.toJSON());
  }

  /** Delete this receiver. */
  public delete(): Promise<void> {
    return this.client.kyc.deleteReceiver(this.id);
  }

  /** Approve it out of review (admin-only). */
  public approve(options: ApproveReceiverOptions = {}): Promise<ReceiverData> {
    return this.client.kyc.approveReceiver(this.id, options);
  }

  /** Ask for a terms-of-service link for this receiver. */
  public requestTos(options: RequestTosOptions): Promise<TermsOfServiceData> {
    return this.client.kyc.requestTos(this.id, options);
  }

  /** Enable it with an accepted terms-of-service id, and patch in place. */
  public async enable(options: EnableReceiverOptions): Promise<this> {
    const enabled = await this.client.kyc.enableReceiver(this.id, options);
    return this._patch(enabled.toJSON());
  }

  /** Cut this receiver off from both ramps, or let it back in. */
  public async setAccess(disabled: boolean): Promise<this> {
    const updated = await this.client.kyc.setReceiverAccess(this.id, { disabled });
    return this._patch(updated.toJSON());
  }

  /** Register a blockchain wallet for this receiver. */
  public addWallet(options: CreateReceiverWalletOptions): Promise<ReceiverWalletData> {
    return this.client.kyc.addWallet(this.id, options);
  }

  /** This receiver's wallets. */
  public wallets(options: ListKycOptions = {}): Promise<ReceiverWalletPage> {
    return this.client.kyc.wallets(this.id, options);
  }

  /** Add a fiat bank account — where an off-ramp pays out. */
  public addBankAccount(options: CreateBankAccountOptions): Promise<BankAccountData> {
    return this.client.kyc.addBankAccount(this.id, options);
  }

  /** This receiver's bank accounts. */
  public bankAccounts(options: ListKycOptions = {}): Promise<BankAccountPage> {
    return this.client.kyc.bankAccounts(this.id, options);
  }

  public toJSON(): ReceiverData {
    return {
      id: this.id,
      blindpayId: this.blindpayId,
      type: this.type,
      kycType: this.kycType,
      kycStatus: this.kycStatus,
      email: this.email,
      name: this.name,
      country: this.country,
      externalId: this.externalId,
      disabled: this.disabled,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
