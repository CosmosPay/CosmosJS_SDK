/**
 * The Stellar Wallets Kit module contract, transcribed.
 *
 * WHY A COPY INSTEAD OF AN IMPORT. A module is one small class; depending on the
 * whole kit to describe it would put a UI library (and, when this was measured, 22
 * dev advisories) into an SDK whose own dependency list is empty. The kit is what a
 * CONSUMER installs — this package only has to produce something that fits it.
 *
 * The shapes below are transcribed from `@creit.tech/stellar-wallets-kit@2.6`
 * (`esm/types/mod.d.ts`) and are structural, so a module written against them is
 * assignable to the kit's `ModuleInterface` without either side knowing about the
 * other. The one place structural typing does not reach is `moduleType`: the kit
 * declares it as a string ENUM, and TypeScript does not accept a plain string
 * literal for one. `CosmosWalletModule` is therefore generic in that property —
 * pass the kit's own `ModuleType.HOT_WALLET` and it type-checks exactly; pass
 * nothing and you get the same string at runtime.
 *
 * Keep this file in step with the kit when it moves. `signAndSubmitTransaction` and
 * `isPlatformWrapper` are deliberately absent below: they are optional in the kit
 * and Cosmos Wallet implements neither.
 */

/** `moduleType` values the kit filters and groups by. */
export const SwkModuleType = {
  HW_WALLET: 'HW_WALLET',
  HOT_WALLET: 'HOT_WALLET',
  BRIDGE_WALLET: 'BRIDGE_WALLET',
  AIR_GAPED_WALLET: 'AIR_GAPED_WALLET',
} as const;

export type SwkModuleTypeValue = (typeof SwkModuleType)[keyof typeof SwkModuleType];

/**
 * What a module rejects with. The kit's `parseError` reads `code`, `message` and
 * `ext` off whatever it catches, so a plain object is the native shape — and `-3`
 * is the code its own modules use for "this wallet cannot do that".
 */
export interface IKitError {
  code: number;
  message: string;
  ext?: string;
}

/** Payload of the optional `onChange` subscription. */
export interface IOnChangeEvent {
  address: string;
  /** Human-readable network name, as the wallet calls it. */
  network: string;
  networkPassphrase: string;
  error?: IKitError;
}

/** Options every signing method accepts. `path` is for hardware wallets. */
export interface SwkSignOptions {
  networkPassphrase?: string;
  address?: string;
  path?: string;
}

/**
 * The kit's `ModuleInterface`, minus the optional members Cosmos Wallet does not
 * implement. `TModuleType` exists only so the kit's enum can flow through — see
 * the header.
 */
export interface SwkModule<TModuleType extends string = SwkModuleTypeValue> {
  moduleType: TModuleType;
  productId: string;
  productName: string;
  productUrl: string;
  productIcon: string;
  /** Must answer in under 1000ms or the kit renders the wallet as unavailable. */
  isAvailable(): Promise<boolean>;
  getAddress(params?: { path?: string; skipRequestAccess?: boolean }): Promise<{ address: string }>;
  signTransaction(
    xdr: string,
    opts?: SwkSignOptions,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }>;
  signAuthEntry(
    authEntry: string,
    opts?: SwkSignOptions,
  ): Promise<{ signedAuthEntry: string; signerAddress?: string }>;
  signMessage(
    message: string,
    opts?: SwkSignOptions,
  ): Promise<{ signedMessage: string; signerAddress?: string }>;
  getNetwork(): Promise<{ network: string; networkPassphrase: string }>;
  onChange?(callback: (event: IOnChangeEvent) => void): void;
  disconnect?(): Promise<void>;
}
