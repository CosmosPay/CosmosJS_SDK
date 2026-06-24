import type { Client } from '@/client/Client';

/**
 * Root of every API structure. Holds a back-reference to the {@link Client} so
 * instances can perform their own actions (e.g. `paymentIntent.delete()`), and
 * provides the `_patch`/`toJSON` plumbing shared by all structures.
 */
export abstract class Base<Data extends { id: string }> {
  /** The client that instantiated this structure. */
  public readonly client: Client;
  /** Unique identifier of the resource. */
  public id!: string;

  protected constructor(client: Client, data: Data) {
    this.client = client;
    this._patch(data);
  }

  /** Merge raw API data onto this instance. Subclasses override and call super. */
  protected _patch(data: Data): this {
    this.id = data.id;
    return this;
  }

  /** Return the raw API representation of this structure. */
  public abstract toJSON(): Data;

  /** Allow `String(structure)` / template literals to resolve to the id. */
  public valueOf(): string {
    return this.id;
  }
}
