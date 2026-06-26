/**
 * Stellar address helpers + a tiny named-address book.
 *
 * So integrators don't have to sprinkle raw `G...` strings everywhere (and risk
 * typos), they can name the accounts they care about once and reference them by
 * name. A plain address string always keeps working — `resolveAddress` only
 * substitutes registered names and otherwise passes the value straight through.
 */

// Stellar strkeys are base32 (RFC 4648 alphabet, no padding). These checks are
// length/prefix sanity checks, not full checksum validation.
const G_ADDRESS = /^G[A-Z2-7]{55}$/; // ed25519 public key (account)
const M_ADDRESS = /^M[A-Z2-7]{68}$/; // muxed account
const C_ADDRESS = /^C[A-Z2-7]{55}$/; // contract id

/** Whether a value looks like a Stellar account address (`G…`). */
export function isStellarAddress(value: unknown): value is string {
  return typeof value === 'string' && G_ADDRESS.test(value);
}

/** Whether a value looks like a muxed account address (`M…`). */
export function isMuxedAddress(value: unknown): value is string {
  return typeof value === 'string' && M_ADDRESS.test(value);
}

/** Whether a value looks like a Soroban contract id (`C…`). */
export function isContractAddress(value: unknown): value is string {
  return typeof value === 'string' && C_ADDRESS.test(value);
}

/** Whether a value is any kind of Stellar address (account, muxed or contract). */
export function isAddress(value: unknown): value is string {
  return isStellarAddress(value) || isMuxedAddress(value) || isContractAddress(value);
}

/** Throw unless `value` is a valid Stellar account/muxed/contract address. */
export function assertAddress(value: unknown, label = 'address'): string {
  if (!isAddress(value)) {
    throw new TypeError(`Invalid Stellar ${label}: ${String(value)}`);
  }
  return value;
}

/**
 * A registry of named Stellar addresses. Register the accounts you use a lot —
 * your merchant payout account, a treasury, frequent counterparties — and refer
 * to them by name anywhere an address is accepted.
 *
 * @example
 * addresses.define('merchant', 'GC...');
 * await client.paymentIntents.createPay({ destination: 'merchant', amount: '10' });
 */
export class AddressBook {
  private readonly entries = new Map<string, string>();

  constructor(initial: Record<string, string> = {}) {
    for (const [name, address] of Object.entries(initial)) {
      this.define(name, address);
    }
  }

  /** Register (or overwrite) a named address. The address is validated. */
  public define(name: string, address: string): this {
    this.entries.set(name, assertAddress(address, `address for "${name}"`));
    return this;
  }

  /** Whether a name is registered. */
  public has(name: string): boolean {
    return this.entries.has(name);
  }

  /** Look up a registered address by name. */
  public get(name: string): string | undefined {
    return this.entries.get(name);
  }

  /** Remove a named address. */
  public delete(name: string): boolean {
    return this.entries.delete(name);
  }

  /** All registered names. */
  public names(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Resolve a reference to a concrete address: a registered name is substituted,
   * any other string is returned unchanged (so raw `G…`, muxed `M…`, federation
   * `name*domain`, etc. all keep working).
   */
  public resolve(ref: string): string {
    return this.entries.get(ref) ?? ref;
  }
}

/** Process-wide default address book. Use `addresses.define(...)` to populate it. */
export const addresses = new AddressBook();

/** Anything accepted where an address is expected: a raw address or a name in a book. */
export type AddressRef = string;

/**
 * Resolve an {@link AddressRef} using the given book (the shared {@link addresses}
 * by default). Lenient: unknown strings pass through unchanged.
 */
export function resolveAddress(ref: AddressRef, book: AddressBook = addresses): string {
  return book.resolve(ref);
}
