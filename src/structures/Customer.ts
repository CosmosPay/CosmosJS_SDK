import type { Client } from '@/client/Client';
import type { CustomerData, UpdateCustomerOptions } from '@/types/index';
import { Base } from '@/structures/Base';

/** A customer record, optionally enriched with on-chain payment stats. */
export class Customer extends Base<CustomerData> {
  public consumerId!: string;
  public name!: string;
  public alias!: string | null;
  public note!: string | null;
  public email!: string | null;
  /** Optional Stellar account associated with the customer. */
  public account!: string | null;
  public reference!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
  /** Number of payment intents from this customer's account (list view only). */
  public payments: number | null = null;
  /** Number of succeeded payments (list view only). */
  public succeeded: number | null = null;
  /** Total settled amount as a decimal string (list view only). */
  public total: string | null = null;

  constructor(client: Client, data: CustomerData) {
    super(client, data);
  }

  protected override _patch(data: CustomerData): this {
    super._patch(data);
    this.consumerId = data.consumerId;
    this.name = data.name;
    this.alias = data.alias;
    this.note = data.note;
    this.email = data.email;
    this.account = data.account;
    this.reference = data.reference;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    if (data.payments !== undefined) this.payments = data.payments;
    if (data.succeeded !== undefined) this.succeeded = data.succeeded;
    if (data.total !== undefined) this.total = data.total;
    return this;
  }

  /** Re-fetch this customer. */
  public fetch(): Promise<Customer> {
    return this.client.customers.fetch(this.id);
  }

  /** Update this customer. Mutates and returns this. */
  public async edit(options: UpdateCustomerOptions): Promise<this> {
    const updated = await this.client.customers.update(this.id, options);
    return this._patch(updated.toJSON());
  }

  /** Delete this customer. */
  public delete() {
    return this.client.customers.delete(this.id);
  }

  public toJSON(): CustomerData {
    return {
      id: this.id,
      consumerId: this.consumerId,
      name: this.name,
      alias: this.alias,
      note: this.note,
      email: this.email,
      account: this.account,
      reference: this.reference,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      ...(this.payments !== null ? { payments: this.payments } : {}),
      ...(this.succeeded !== null ? { succeeded: this.succeeded } : {}),
      ...(this.total !== null ? { total: this.total } : {}),
    };
  }
}
