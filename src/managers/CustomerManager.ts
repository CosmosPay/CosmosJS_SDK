import { Customer } from '@/structures/Customer';
import type {
  CreateCustomerOptions,
  CustomerData,
  CustomerListData,
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
 * });
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
}
