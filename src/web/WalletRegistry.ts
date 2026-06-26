/**
 * Registry + auto-detection for wallet adapters.
 *
 * Holds adapters in priority order and picks the right one automatically — the
 * caller never has to name a provider. Detection is just "ask each adapter if
 * it's available, take the first that says yes," honoring an optional preference.
 */

import { WalletNotFoundError } from '@/web/errors';
import type { WalletAdapter, WalletInfo } from '@/web/types';

export class WalletRegistry {
  private readonly adapters: WalletAdapter[] = [];

  constructor(adapters: WalletAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  /**
   * Register (or replace, by id) a wallet adapter. By default it's appended at
   * the lowest priority; pass `prepend` to make it win auto-detection.
   */
  public register(adapter: WalletAdapter, prepend = false): this {
    const existing = this.adapters.findIndex((a) => a.id === adapter.id);
    if (existing !== -1) this.adapters.splice(existing, 1);
    if (prepend) this.adapters.unshift(adapter);
    else this.adapters.push(adapter);
    return this;
  }

  /** Remove an adapter by id. */
  public unregister(id: string): this {
    const index = this.adapters.findIndex((a) => a.id === id);
    if (index !== -1) this.adapters.splice(index, 1);
    return this;
  }

  /** Get a registered adapter by id. */
  public get(id: string): WalletAdapter | undefined {
    return this.adapters.find((a) => a.id === id);
  }

  /** All registered adapter ids, in priority order. */
  public ids(): string[] {
    return this.adapters.map((a) => a.id);
  }

  /** Probe every adapter and report which are available. */
  public async list(): Promise<WalletInfo[]> {
    return Promise.all(
      this.adapters.map(async (adapter) => ({
        id: adapter.id,
        name: adapter.name,
        icon: adapter.icon,
        available: await safeAvailable(adapter),
      })),
    );
  }

  /** The available adapters, in priority order. */
  public async available(): Promise<WalletAdapter[]> {
    const flags = await Promise.all(this.adapters.map(safeAvailable));
    return this.adapters.filter((_, i) => flags[i]);
  }

  /**
   * Pick a wallet automatically. If `preferred` is given and available it wins;
   * otherwise the first available adapter (in priority order) is returned.
   * Throws {@link WalletNotFoundError} when nothing is available.
   */
  public async detect(preferred?: string): Promise<WalletAdapter> {
    if (preferred) {
      const adapter = this.get(preferred);
      if (adapter && (await safeAvailable(adapter))) return adapter;
    }
    const available = await this.available();
    if (available[0]) return available[0];
    throw new WalletNotFoundError(this.ids());
  }
}

async function safeAvailable(adapter: WalletAdapter): Promise<boolean> {
  try {
    return await adapter.isAvailable();
  } catch {
    return false;
  }
}
