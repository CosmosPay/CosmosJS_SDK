/**
 * Cosmos Wallet as a Stellar Wallets Kit module.
 *
 * The kit is how most Stellar dapps ask for a signature: they register a list of
 * modules and it renders one button per wallet. A wallet that is not a module is a
 * wallet those dapps cannot see, however good its provider is — which is the whole
 * reason this file exists. Registering it:
 *
 * ```ts
 * import { StellarWalletsKit, WalletNetwork, ModuleType } from '@creit.tech/stellar-wallets-kit';
 * import { CosmosWalletModule, COSMOS_WALLET_ID } from '@cosmosapp/pay_sdk/swk';
 *
 * const kit = new StellarWalletsKit({
 *   network: WalletNetwork.PUBLIC,
 *   selectedWalletId: COSMOS_WALLET_ID,
 *   modules: [
 *     // `moduleType` is the kit's own enum — passing it here keeps the module
 *     // exactly assignable to `ModuleInterface` with no cast anywhere.
 *     new CosmosWalletModule({ moduleType: ModuleType.HOT_WALLET }),
 *   ],
 * });
 * ```
 *
 * TWO TRANSPORTS, ONE MODULE. With the extension installed the provider is already
 * on the page. Without it, pass `walletUrl` and the hosted wallet's provider script
 * is fetched from that origin on first use, so a dapp can offer Cosmos Wallet to
 * users who have installed nothing:
 *
 * ```ts
 * new CosmosWalletModule({ walletUrl: 'https://wallet.cosmospay.lat' })
 * ```
 *
 * WHAT IT REFUSES, AND WHY THAT IS THE POINT. `signAuthEntry` rejects with the
 * kit's own `-3` "not supported" shape rather than returning something. Cosmos
 * Wallet signs transactions and domain-separated messages; it does not sign Soroban
 * authorization entries, and a module that faked one would hand a dapp a signature
 * that fails on chain instead of an error it can render.
 */

import {
  injectedProvider,
  resolveProvider,
  type CosmosProviderOptions,
  type CosmosWalletProvider,
} from '@/web/cosmosProvider';
import { SwkModuleType, type IKitError, type SwkModule, type SwkSignOptions } from '@/swk/types';

/** The id a dapp filters or preselects this wallet by. */
export const COSMOS_WALLET_ID = 'cosmos-wallet';

const PRODUCT_NAME = 'Cosmos Wallet';
const PRODUCT_URL = 'https://github.com/CosmosPay/CosmosPay-Wallet';
/**
 * Served from the wallet's repository so the module has nothing to host. When this
 * module is upstreamed the kit serves its own copy from `stellar.creit.tech`, which
 * is why the URL is an option rather than a constant baked into every call site.
 */
const PRODUCT_ICON =
  'https://raw.githubusercontent.com/CosmosPay/CosmosPay-Wallet/main/public/logo-512.png';

/** The kit's code for "this wallet cannot do that" (see its own modules). */
const NOT_SUPPORTED = -3;

export interface CosmosWalletModuleOptions<TModuleType extends string = string>
  extends CosmosProviderOptions {
  /**
   * Pass the kit's `ModuleType.HOT_WALLET` for exact typing. Defaults to the same
   * string, which is what the enum holds at runtime.
   */
  moduleType?: TModuleType;
  /** Override the name shown in the kit's modal. */
  productName?: string;
  /** Override the "get this wallet" link. */
  productUrl?: string;
  /** Override the icon shown in the modal. */
  productIcon?: string;
}

export class CosmosWalletModule<TModuleType extends string = string>
  implements SwkModule<TModuleType>
{
  public readonly moduleType: TModuleType;
  public readonly productId: string = COSMOS_WALLET_ID;
  public readonly productName: string;
  public readonly productUrl: string;
  public readonly productIcon: string;

  private readonly options: CosmosProviderOptions;

  constructor(options: CosmosWalletModuleOptions<TModuleType> = {}) {
    this.moduleType = (options.moduleType ?? SwkModuleType.HOT_WALLET) as TModuleType;
    this.productName = options.productName ?? PRODUCT_NAME;
    this.productUrl = options.productUrl ?? PRODUCT_URL;
    this.productIcon = options.productIcon ?? PRODUCT_ICON;
    this.options = {
      provider: options.provider,
      walletUrl: options.walletUrl,
      loadTimeoutMs: options.loadTimeoutMs,
    };
  }

  /**
   * The kit allows 1000ms for this and shows the wallet as unavailable otherwise,
   * so it answers from what is already in the page: an injected provider, or a
   * configured hosted wallet — which needs no install and is therefore always
   * usable. The hosted script itself is fetched on the first real call.
   */
  public async isAvailable(): Promise<boolean> {
    if (this.options.provider) return true;
    if (injectedProvider()) return true;
    return !!this.options.walletUrl;
  }

  private async provider(): Promise<CosmosWalletProvider> {
    const provider = await resolveProvider(this.options);
    if (!provider) throw kitError(`${this.productName} is not available.`, -1);
    return provider;
  }

  /**
   * `skipRequestAccess` is accepted and ignored on purpose: the wallet decides
   * whether an origin it already knows needs to be asked again, and a dapp asking
   * to skip the prompt is not the party that gets to decide that.
   */
  public async getAddress(_params?: { path?: string; skipRequestAccess?: boolean }): Promise<{
    address: string;
  }> {
    const provider = await this.provider();
    const { address } = await provider.getAddress();
    if (!address) throw kitError('The wallet returned no address.', -1);
    return { address };
  }

  public async signTransaction(
    xdr: string,
    opts?: SwkSignOptions,
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    const provider = await this.provider();
    // The passphrase is forwarded, not authoritative: Cosmos Wallet parses with its
    // own network configuration and REFUSES a mismatch, so a caller cannot redirect
    // a signature to another network by naming one. Forwarding it is what turns a
    // wrong-network request into an error the dapp can show.
    const result = await provider.signTransaction(xdr, {
      networkPassphrase: opts?.networkPassphrase,
      address: opts?.address,
    });
    if (!result?.signedTxXdr) throw kitError('The wallet returned no signed transaction.', -1);
    return { signedTxXdr: result.signedTxXdr, signerAddress: result.signerAddress };
  }

  public async signMessage(
    message: string,
    opts?: SwkSignOptions,
  ): Promise<{ signedMessage: string; signerAddress?: string }> {
    const provider = await this.provider();
    const result = await provider.signMessage(message, {
      networkPassphrase: opts?.networkPassphrase,
      address: opts?.address,
    });
    if (!result?.signedMessage) throw kitError('The wallet returned no signature.', -1);
    return { signedMessage: result.signedMessage, signerAddress: result.signerAddress };
  }

  /**
   * Not supported, and reported as such in the kit's own vocabulary.
   *
   * Cosmos Wallet has no Soroban authorization-entry signing. Anything this could
   * return instead of an error would be a signature the network rejects, discovered
   * by the user rather than by the dapp.
   */
  public signAuthEntry(): Promise<{ signedAuthEntry: string; signerAddress?: string }> {
    return Promise.reject(
      kitError(`${this.productName} does not support the "signAuthEntry" function`, NOT_SUPPORTED),
    );
  }

  /**
   * The network the WALLET is on, which is the only one it will sign for. A dapp
   * that wants another network has to ask the user to switch, not ask the wallet to
   * pretend.
   */
  public async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    const provider = await this.provider();
    const { network, networkPassphrase } = await provider.getNetwork();
    if (!networkPassphrase) throw kitError('The wallet returned no network.', -1);
    return { network, networkPassphrase };
  }
}

/**
 * The kit reads `code`, `message` and `ext` off whatever a module rejects with, and
 * its own modules reject with a plain object. This keeps the `Error` prototype (so
 * a stack survives and `instanceof Error` holds for anyone else who catches it)
 * while carrying the fields the kit looks for.
 */
function kitError(message: string, code: number): Error & IKitError {
  return Object.assign(new Error(message), { code, message });
}
