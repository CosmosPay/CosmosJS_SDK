/**
 * EIP-681 payment links (`ethereum:...`), the EVM links Cosmos Pay hands out for a deposit, as the
 * transaction an EVM wallet sends: a native payment (`ethereum:<to>@<chainId>?value=<wei>`) or an
 * ERC-20 transfer (`ethereum:<token>@<chainId>/transfer?address=<to>&uint256=<amount>`).
 */

import { erc20TransferData, toQuantity } from '@/wallets/encoding';

/** The transaction a link asks for, without its sender. */
export interface Eip681Transaction {
  chainId: number;
  to: string;
  /** Wei, 0x-hex (absent for a token transfer). */
  value?: string;
  /** The ERC-20 `transfer` call (absent for a native payment). */
  data?: string;
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** Read an EIP-681 payment link. Throws on any other kind of link. */
export function parseEip681(uri: string): Eip681Transaction {
  const match = /^ethereum:(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\/([A-Za-z_]\w*))?(?:\?(.*))?$/.exec(
    uri.trim(),
  );
  if (!match) throw new TypeError('Not an EIP-681 payment link');
  const [, target = '', chain, fn, query = ''] = match;
  const params = new URLSearchParams(query);
  const chainId = chain ? Number(chain) : 1;
  if (!Number.isSafeInteger(chainId) || chainId <= 0) throw new TypeError('Not a valid chain id');
  if (!fn) {
    const value = params.get('value');
    return { chainId, to: target, ...(value ? { value: toQuantity(plainInteger(value)) } : {}) };
  }
  if (fn !== 'transfer') throw new TypeError(`Unsupported EIP-681 function: ${fn}`);
  const recipient = params.get('address') ?? '';
  const amount = params.get('uint256');
  if (!ADDRESS.test(recipient)) throw new TypeError('The link names no recipient address');
  if (!amount) throw new TypeError('The link names no amount');
  return { chainId, to: target, data: erc20TransferData(recipient, plainInteger(amount)) };
}

/** EIP-681 also allows `1e18`-style numbers: the integer they spell. */
function plainInteger(value: string): string {
  if (/^\d+$/.test(value)) return value;
  const sci = /^(\d+)(?:\.(\d+))?e(\d+)$/i.exec(value);
  if (sci) {
    const [, whole = '', fraction = '', exponent = '0'] = sci;
    const shift = Number(exponent);
    if (fraction.length <= shift) return (whole + fraction.padEnd(shift, '0')).replace(/^0+(?=\d)/, '');
  }
  throw new TypeError(`Not an integer amount: "${value}"`);
}
