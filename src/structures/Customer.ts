import type { Client } from '@/client/Client';
import type { CustomerData, UpdateCustomerOptions } from '@/types/index';
import { Base } from '@/structures/Base';

/** A customer record, optionally enriched with on-chain payment stats. */
export class Customer extends Base<CustomerData> {
  public name!: string;
  public alias!: string | null;
  public note!: string | null;
  public email!: string | null;
  /** Optional Stellar account associated with the customer. */
  public account!: string | null;
  public reference!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;
  // No initializers on the three below: a field initializer runs after `super()`,
  // that is after `_patch`, and would reset what the list response carried.
  /** Number of payment intents from this customer's account (list view only). */
  public payments!: number | null;
  /** Number of succeeded payments (list view only). */
  public succeeded!: number | null;
  /** Total settled amount as a decimal string (list view only). */
  public total!: string | null;

  constructor(client: Client, data: CustomerData) {
    super(client, data);
  }

  protected override _patch(data: CustomerData): this {
    super._patch(data);
    this.name = data.name;
    this.alias = data.alias;
    this.note = data.note;
    this.email = data.email;
    this.account = data.account;
    this.reference = data.reference;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    // A response without stats (fetch, update) keeps the ones already read.
    this.payments = data.payments ?? this.payments ?? null;
    this.succeeded = data.succeeded ?? this.succeeded ?? null;
    this.total = data.total ?? this.total ?? null;
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
