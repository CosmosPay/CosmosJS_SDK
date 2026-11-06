# Wallets: Stellar, EVM and Solana

`@cosmosapp/pay_sdk/wallets` finds every wallet a person can sign with in their browser and
gives each the same small shape, whatever its ecosystem. It bundles no wallet library: each
ecosystem is reached through its own open standard.

| Ecosystem | Reached through | Wallets |
| --- | --- | --- |
| `stellar` | the SDK's adapters, plus a Stellar Wallets Kit when passed | Freighter (now Varial), xBull, Rabet, LOBSTR, Albedo, Cosmos Pay Wallet; with a kit also Hana, MetaMask (Stellar Snap), Klever, OneKey, Bitget, Ledger, WalletConnect... |
| `evm` | EIP-6963 announcements, else `window.ethereum` | MetaMask, Rabby, Coinbase Wallet, OKX, Trust, Brave... |
| `solana` | Wallet Standard (`wallet-standard:register-wallet` / `app-ready`) | Phantom, Solflare, Backpack... |

```ts
import { discoverWallets, EvmChains, isUserRejection } from '@cosmosapp/pay_sdk/wallets';

const { stellar, evm, solana } = await discoverWallets(); // each an array, possibly empty
```

Every wallet has `id` (`stellar:freighter`, `evm:io.metamask`, `solana:phantom`), `name`,
`icon` (the wallet's own, when it gives one) and `ecosystem`. Outside a browser every list is
empty. Pass `{ ecosystems: ['evm'] }` to look in one ecosystem only.

## Stellar

```ts
const wallet = stellar[0];
const address = await wallet.connect('public');                 // or 'testnet'
const signedXdr = await wallet.signTransaction(xdr, { network: 'public', address });
await swap.submit({ signedXdr });
```

With a Stellar Wallets Kit, its wallets join the list (a wallet both reach is listed once, through
the adapter, with the kit's name and icon). Kit v2's static class and a v1 instance both work:

```ts
import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';

StellarWalletsKit.init({ modules: defaultModules() });
const { stellar } = await discoverWallets({ stellar: { kit: StellarWalletsKit } });
```

`stellar.injected` passes wallet libraries that have no global (LOBSTR, Albedo, a hosted Cosmos
Pay Wallet), as in `WebClient`.

## EVM (Monad)

EVM wallets cannot hand a signed transaction back: they sign and broadcast it themselves, so
`sendTransaction` answers the transaction hash. It switches the wallet to the transaction's chain
first, adding the chain when the wallet does not know it (`EvmChains.monad`,
`EvmChains.monadTestnet`).

```ts
const wallet = evm.find((w) => w.rdns === 'io.metamask') ?? evm[0];
const from = await wallet.connect();
if (swap.approval) {
  const approval = await wallet.sendTransaction({ from, ...swap.approval }, EvmChains.monad);
  await wallet.waitForTransaction(approval); // the swap needs the allowance mined
}
const txHash = await wallet.sendTransaction({ from, ...swap.transaction }, EvmChains.monad);
```

`wallet.provider` is the wallet's EIP-1193 provider for anything else. `erc20TransferData(to,
amount)` builds a token transfer's call data; `toQuantity` turns a decimal amount of wei into the
hex a wallet takes.

## Solana

```ts
const wallet = solana[0];
const address = await wallet.connect();
const signedTransaction = await wallet.signTransaction(swap.transaction.data); // base64 in and out
await swap.submit({ signedTransaction });
```

`signTransaction` signs without broadcasting, so the API can check the transaction and relay it.
`signAndSendTransaction` (when `canSignAndSend`) broadcasts too and answers the signature.
Chains are `solana:mainnet` (the default), `solana:devnet` and `solana:testnet`.

## Errors

A wallet's failure is a `WalletError` (`error.wallet` is the wallet id, `error.cause` the
wallet's own error). `isUserRejection(error)` tells the person declining (closing the prompt,
pressing reject, EIP-1193 code 4001) from a failure worth reporting.
