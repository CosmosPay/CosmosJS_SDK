/**
 * Shared, dependency-free building blocks used by both the server SDK and the
 * browser web client: typed asset/wallet catalogs and address helpers.
 */

// Assets
export {
  Assets,
  TestnetAssets,
  defineAsset,
  resolveAsset,
  isNativeAsset,
} from '@/common/assets';
export type { AssetDefinition, AssetRef, ResolvedAsset } from '@/common/assets';

// Wallets
export { Wallets } from '@/common/wallets';
export type { WalletId } from '@/common/wallets';

// Addresses
export {
  AddressBook,
  addresses,
  resolveAddress,
  isStellarAddress,
  isMuxedAddress,
  isContractAddress,
  isAddress,
  assertAddress,
} from '@/common/addresses';
export type { AddressRef } from '@/common/addresses';

// Intent input resolution
export { resolveIntentBody } from '@/common/intent-input';
export type { ResolvableIntentInput } from '@/common/intent-input';
