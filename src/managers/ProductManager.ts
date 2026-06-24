import { Product } from '@/structures/Product';
import type {
  CreateProductOptions,
  ProductData,
  UpdateProductOptions,
} from '@/types/index';
import { BaseManager } from '@/managers/BaseManager';

type ProductDeletedData = { id: string; deleted: boolean };

/**
 * Manages products / prices — `client.products`.
 *
 * @example
 * const product = await client.products.create({
 *   name: 'Pro plan — monthly', amount: '49.00', assetCode: 'USDC',
 * });
 */
export class ProductManager extends BaseManager<Product> {
  private readonly route = '/products';

  /** Create a product. */
  public async create(options: CreateProductOptions): Promise<Product> {
    const data = await this.rest.post<ProductData>(this.route, { body: options });
    return this._add(new Product(this.client, data));
  }

  /** List the consumer's products. */
  public async list(): Promise<Product[]> {
    const data = await this.rest.get<ProductData[]>(this.route);
    return data.map((d) => this._add(new Product(this.client, d)));
  }

  /** Get a product by id. */
  public async fetch(id: string): Promise<Product> {
    const data = await this.rest.get<ProductData>(`${this.route}/${id}`);
    return this._add(new Product(this.client, data));
  }

  /** Update a product. */
  public async update(
    id: string,
    options: UpdateProductOptions,
  ): Promise<Product> {
    const data = await this.rest.patch<ProductData>(`${this.route}/${id}`, {
      body: options,
    });
    return this._add(new Product(this.client, data));
  }

  /** Delete a product. */
  public async delete(id: string): Promise<ProductDeletedData> {
    const result = await this.rest.delete<ProductDeletedData>(
      `${this.route}/${id}`,
    );
    this.cache.delete(id);
    return result;
  }
}
