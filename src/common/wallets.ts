/**
 * Typed identifiers for the wallets the web client knows about, so you can write
 * `Wallets.FREIGHTER` instead of remembering the `'freighter'` magic string —
 * while any custom adapter id still works.
 */

/** Built-in wallet ids (matches each adapter's `id`). */
export const Wallets = {
  FREIGHTER: 'freighter',
  XBULL: 'xbull',
  RABET: 'rabet',
  LOBSTR: 'lobstr',
  ALBEDO: 'albedo',
} as const;

/** A known wallet id, or any custom adapter id (autocomplete for the built-ins). */
export type WalletId = (typeof Wallets)[keyof typeof Wallets] | (string & {});
