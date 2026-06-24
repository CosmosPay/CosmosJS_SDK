import type { Client } from '@/client/Client';
import {
  ProductKind,
  type ProductData,
  type UpdateProductOptions,
} from '@/types/index';
import { Base } from '@/structures/Base';

/** A product / price the consumer can charge for. */
export class Product extends Base<ProductData> {
  public name!: string;
  public description!: string | null;
  public amount!: string | null;
  /** Asset code, or `native` for XLM. */
  public asset!: string;
  public kind!: ProductKind;
  public active!: boolean;
  public reference!: string | null;
  public createdAt!: Date;
  public updatedAt!: Date;

  constructor(client: Client, data: ProductData) {
    super(client, data);
  }

  protected override _patch(data: ProductData): this {
    super._patch(data);
    this.name = data.name;
    this.description = data.description;
    this.amount = data.amount;
    this.asset = data.asset;
    this.kind = data.kind;
    this.active = data.active;
    this.reference = data.reference;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
    return this;
  }

  /** Human-readable asset label (`XLM` for native). */
  public get assetLabel(): string {
    return !this.asset || this.asset === 'native' ? 'XLM' : this.asset;
  }

  /** Re-fetch this product. */
  public fetch(): Promise<Product> {
    return this.client.products.fetch(this.id);
  }

  /** Update this product. Mutates and returns this. */
  public async edit(options: UpdateProductOptions): Promise<this> {
    const updated = await this.client.products.update(this.id, options);
    return this._patch(updated.toJSON());
  }

  /** Mark the product active. */
  public activate(): Promise<this> {
    return this.edit({ active: true });
  }

  /** Mark the product inactive. */
  public deactivate(): Promise<this> {
    return this.edit({ active: false });
  }

  /** Delete this product. */
  public delete() {
    return this.client.products.delete(this.id);
  }

  public toJSON(): ProductData {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      amount: this.amount,
      asset: this.asset,
      kind: this.kind,
      active: this.active,
      reference: this.reference,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
