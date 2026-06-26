/** Small shared helpers for wallet adapters. */

/** Return the global `window`, or `undefined` outside a browser (SSR-safe). */
export function getWindow(): (Window & typeof globalThis) | undefined {
  return typeof window !== 'undefined' ? window : undefined;
}

/**
 * Read a (possibly nested) global injected by a browser extension, e.g.
 * `globalRef('freighterApi')`. Returns `undefined` when not in a browser or the
 * global is absent.
 */
export function globalRef<T = unknown>(name: string): T | undefined {
  const win = getWindow();
  if (!win) return undefined;
  return (win as unknown as Record<string, T>)[name];
}

/**
 * Modern wallet APIs return `{ value, error }` envelopes; older ones returned a
 * bare value. Normalize both: throw on `error`, otherwise pull `key` (falling
 * back to the raw value for legacy string returns).
 */
export function unwrap<T>(result: unknown, key: string): T {
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    if (obj['error']) {
      const err = obj['error'];
      const message =
        typeof err === 'string'
          ? err
          : (err as { message?: string })?.message ?? JSON.stringify(err);
      throw new Error(message);
    }
    if (key in obj) return obj[key] as T;
  }
  return result as T;
}

/** Coerce any thrown value into a readable message. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
