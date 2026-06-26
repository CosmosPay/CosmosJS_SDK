import { EventEmitter } from 'node:events';
import type { Client } from '@/client/Client';
import type { REST } from '@/rest/REST';

/**
 * Base class for all resource managers. Each manager owns a slice of the API
 * (payment intents, webhooks, ...) and a lightweight in-memory cache of the
 * structures it has materialized — an atomic, per-resource manager pattern.
 *
 * Extends EventEmitter so managers that surface real-time events (e.g. the
 * webhook listener) can `emit`/`on` without extra plumbing.
 */
export abstract class BaseManager<
  Structure extends { id: string },
> extends EventEmitter {
  public readonly client: Client;
  /** Cache of structures keyed by id, populated on fetch/create. */
  public readonly cache: Map<string, Structure> = new Map();

  constructor(client: Client) {
    super();
    this.client = client;
  }

  /** Shortcut to the shared REST instance. */
  protected get rest(): REST {
    return this.client.rest;
  }

  /** Store a structure in the cache and return it. */
  protected _add(structure: Structure): Structure {
    this.cache.set(structure.id, structure);
    return structure;
  }

  /** Resolve an id from either a raw id or a structure instance. */
  public resolveId(idOrStructure: string | { id: string }): string {
    return typeof idOrStructure === 'string' ? idOrStructure : idOrStructure.id;
  }
}
