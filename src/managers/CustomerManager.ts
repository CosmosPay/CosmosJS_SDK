import { pathSegment } from '@/util/path';
import { Customer } from '@/structures/Customer';
import type {
  AddCustomerWalletOptions,
  CreateCustomerOptions,
  CustomerData,
  CustomerListData,
  CustomerWalletData,
  CustomerWalletDeletedData,
  UpdateCustomerOptions,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

type CustomerDeletedData = { id: string; deleted: boolean };

/**
 * Manages customers — `client.customers`.
 *
 * @example
 * const customer = await client.customers.create({
 *   name: 'Acme Inc.', email: 'billing@acme.com',
 *   wallets: [{ chain: 'stellar', address: 'G...' }],
 * });
 * await customer.addWallet({ chain: 'solana', address: '7EcD...', label: 'Phantom' });
 */
export class CustomerManager extends BaseManager<Customer> {
  private readonly route = '/customers';

  /** Create a customer. */
  public async create(options: CreateCustomerOptions): Promise<Customer> {
    const data = await this.rest.post<CustomerData>(this.route, { body: options });
    return this._add(new Customer(this.client, data));
  }

  /** List the consumer's customers (with payment stats). */
  public async list(): Promise<Customer[]> {
    const data = await this.rest.get<CustomerListData>(this.route);
    return data.data.map((d) => this._add(new Customer(this.client, d)));
  }

  /** Get a customer by id. */
  public async fetch(id: string): Promise<Customer> {
    const data = await this.rest.get<CustomerData>(`${this.route}/${id}`);
    return this._add(new Customer(this.client, data));
  }

  /** Update a customer. */
  public async update(
    id: string,
    options: UpdateCustomerOptions,
  ): Promise<Customer> {
    const data = await this.rest.patch<CustomerData>(`${this.route}/${id}`, {
      body: options,
    });
    return this._add(new Customer(this.client, data));
  }

  /** Delete a customer. */
  public async delete(id: string): Promise<CustomerDeletedData> {
    const result = await this.rest.delete<CustomerDeletedData>(
      `${this.route}/${id}`,
    );
    this.cache.delete(id);
    return result;
  }

  /**
   * Add a wallet to a customer, on Stellar, Solana or Monad (up to 20 per
   * customer); payments paid from it count toward the customer. A wallet the
   * customer already holds answers as it is; one another of your customers holds
   * is `409 customer_wallet_taken`.
   */
  public async addWallet(
    customerId: string,
    options: AddCustomerWalletOptions,
  ): Promise<CustomerWalletData> {
    return this.rest.post<CustomerWalletData>(`${this.route}/${pathSegment(customerId)}/wallets`, {
      body: options,
    });
  }

  /**
   * Remove a wallet from a customer. Payments from that address stop counting
   * toward it, and a later settled payment from it adds it as a new automatic
   * customer. A `walletId` that is not one of this customer's wallets is 404.
   */
  public async removeWallet(
    customerId: string,
    walletId: string,
  ): Promise<CustomerWalletDeletedData> {
    return this.rest.delete<CustomerWalletDeletedData>(
      `${this.route}/${pathSegment(customerId)}/wallets/${pathSegment(walletId)}`,
    );
  }
}
