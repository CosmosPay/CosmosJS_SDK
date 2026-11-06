/**
 * Small, dependency-free encodings the wallets need in a browser (no Node `Buffer` there):
 * base64 to bytes and back, and amounts to the 0x-hex an EVM wallet takes.
 */

/** base64 (standard alphabet) to bytes. */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64.trim());
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Bytes to base64 (standard alphabet). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * A wei amount as an EVM wallet takes it: 0x-hex. Accepts a decimal string of wei, a 0x-hex
 * string, a bigint or a safe integer.
 */
export function toQuantity(value: string | number | bigint): string {
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) {
    return `0x${BigInt(value).toString(16)}`;
  }
  if (typeof value === 'string' && !/^\d+$/.test(value)) {
    throw new TypeError(`Not an amount of wei: "${value}"`);
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new TypeError(`Not a safe integer amount of wei: ${value}`);
  }
  return `0x${BigInt(value).toString(16)}`;
}

/**
 * The call data of an ERC-20 `transfer(to, amount)`: selector a9059cbb, the recipient and the
 * amount (in the token's smallest unit) each as a 32-byte word.
 */
export function erc20TransferData(to: string, amount: string | bigint): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(to)) throw new TypeError(`Not an EVM address: "${to}"`);
  const value = typeof amount === 'bigint' ? amount : BigInt(amount);
  if (value < 0n) throw new RangeError('A transfer amount cannot be negative');
  const word = (hex: string) => hex.padStart(64, '0');
  return `0xa9059cbb${word(to.slice(2).toLowerCase())}${word(value.toString(16))}`;
}
