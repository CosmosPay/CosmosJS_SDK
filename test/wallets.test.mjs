// Wallets module tests: fully offline. An EventTarget stands in for the page's window, and fake
// wallets speak the real protocols (EIP-6963 + EIP-1193, Wallet Standard, the Stellar Wallets
// Kit API), so no extension or network is touched.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  discoverWallets,
  discoverEvmWallets,
  discoverSolanaWallets,
  discoverStellarWallets,
  isUserRejection,
  erc20TransferData,
  toQuantity,
  bytesToBase58,
  base64ToBytes,
  bytesToBase64,
  EvmChains,
  WalletError,
  parseEip681,
} from '../dist/wallets/index.js';
import { PASSPHRASES } from '../dist/web/index.js';

// Node 18 has no global CustomEvent.
function detailEvent(type, detail) {
  return Object.assign(new Event(type), { detail });
}

/** An EIP-1193 provider that answers from `handlers` and records every request. */
function fakeProvider(handlers, flags = {}) {
  const calls = [];
  return {
    ...flags,
    calls,
    async request({ method, params }) {
      calls.push({ method, params });
      const handler = handlers[method];
      if (!handler) throw Object.assign(new Error(`unsupported ${method}`), { code: 4200 });
      return handler(params);
    },
  };
}

/** A wallet that announces itself on EIP-6963 whenever the page asks. */
function announceOn(win, info, provider) {
  win.addEventListener('eip6963:requestProvider', () => {
    win.dispatchEvent(detailEvent('eip6963:announceProvider', Object.freeze({ info, provider })));
  });
}

const HASH = `0x${'ab'.repeat(32)}`;

test('EVM: every EIP-6963 wallet once, by rdns', async () => {
  const win = new EventTarget();
  const metamask = fakeProvider({});
  announceOn(win, { uuid: 'u1', name: 'MetaMask', icon: 'data:image/svg+xml,mm', rdns: 'io.metamask' }, metamask);
  announceOn(win, { uuid: 'u1b', name: 'MetaMask', icon: 'data:image/svg+xml,mm', rdns: 'io.metamask' }, metamask);
  announceOn(win, { uuid: 'u2', name: 'Rabby Wallet', icon: 'data:image/svg+xml,rb', rdns: 'io.rabby' }, fakeProvider({}));
  win.ethereum = metamask;
  const wallets = await discoverEvmWallets(win, { timeoutMs: 10 });
  assert.deepEqual(
    wallets.map((w) => [w.id, w.name, w.ecosystem, w.rdns]),
    [
      ['evm:io.metamask', 'MetaMask', 'evm', 'io.metamask'],
      ['evm:io.rabby', 'Rabby Wallet', 'evm', 'io.rabby'],
    ],
  );
  assert.equal(wallets[0].icon, 'data:image/svg+xml,mm');
});

test('EVM: window.ethereum when nothing announces', async () => {
  const win = new EventTarget();
  win.ethereum = fakeProvider({}, { isMetaMask: true });
  const wallets = await discoverEvmWallets(win, { timeoutMs: 5 });
  assert.deepEqual(wallets.map((w) => [w.id, w.name]), [['evm:io.metamask', 'MetaMask']]);
  assert.deepEqual(await discoverEvmWallets(new EventTarget(), { timeoutMs: 5 }), []);
  assert.deepEqual(await discoverEvmWallets(undefined), []);
});

test('EVM: connect, add the chain the wallet lacks, send, wait for the receipt', async () => {
  let chain = '0x1';
  const provider = fakeProvider({
    eth_requestAccounts: () => ['0x1111111111111111111111111111111111111111'],
    eth_chainId: () => chain,
    wallet_switchEthereumChain: ([{ chainId }]) => {
      if (chainId !== chain) throw Object.assign(new Error('Unrecognized chain'), { code: 4902 });
      return null;
    },
    wallet_addEthereumChain: ([params]) => {
      chain = params.chainId;
      return null;
    },
    eth_sendTransaction: () => HASH,
    eth_getTransactionReceipt: () => ({ status: '0x1', blockNumber: '0x10' }),
  });
  const win = new EventTarget();
  announceOn(win, { uuid: 'u', name: 'MetaMask', rdns: 'io.metamask' }, provider);
  const [wallet] = await discoverEvmWallets(win, { timeoutMs: 5 });
  const from = await wallet.connect();
  const hash = await wallet.sendTransaction(
    { from, to: '0x2222222222222222222222222222222222222222', data: '0xdeadbeef', value: '1000000000000000000', chainId: 143 },
    EvmChains.monad,
  );
  assert.equal(hash, HASH);
  const methods = provider.calls.map((c) => c.method);
  assert.deepEqual(methods, [
    'eth_requestAccounts',
    'eth_chainId',
    'wallet_switchEthereumChain',
    'wallet_addEthereumChain',
    'eth_sendTransaction',
  ]);
  const added = provider.calls[3].params[0];
  assert.equal(added.chainId, '0x8f');
  assert.deepEqual(added.rpcUrls, ['https://rpc.monad.xyz']);
  assert.deepEqual(provider.calls[4].params[0], {
    from,
    to: '0x2222222222222222222222222222222222222222',
    data: '0xdeadbeef',
    value: '0xde0b6b3a7640000',
  });
  assert.deepEqual(await wallet.waitForTransaction(hash, { intervalMs: 1 }), {
    hash: HASH,
    status: 'success',
    blockNumber: 16,
  });
  assert.equal(await wallet.chainId(), 143);
});

test('EVM: a chain the wallet lacks, by id alone, and a rejection', async () => {
  const provider = fakeProvider({
    eth_chainId: () => '0x1',
    wallet_switchEthereumChain: () => {
      throw Object.assign(new Error('Unrecognized chain'), { code: -32603, data: { originalError: { code: 4902 } } });
    },
    eth_sendTransaction: () => {
      throw Object.assign(new Error('MetaMask Tx Signature: User denied transaction signature.'), { code: 4001 });
    },
  });
  const win = new EventTarget();
  announceOn(win, { uuid: 'u', name: 'MetaMask', rdns: 'io.metamask' }, provider);
  const [wallet] = await discoverEvmWallets(win, { timeoutMs: 5 });
  await assert.rejects(wallet.switchChain(143), /does not know chain 143/);
  const error = await wallet
    .sendTransaction({ from: '0x1111111111111111111111111111111111111111', to: '0x2222222222222222222222222222222222222222' })
    .catch((e) => e);
  assert.ok(error instanceof WalletError);
  assert.equal(error.wallet, 'evm:io.metamask');
  assert.ok(isUserRejection(error));
});

/** A Wallet Standard wallet that registers the way `@wallet-standard/wallet` does. */
function standardWallet(name, chains, { signAndSend = true } = {}) {
  const account = { address: 'So1anaAccount1111111111111111111111111111111', chains, features: [] };
  const calls = [];
  const wallet = {
    version: '1.0.0',
    name,
    icon: `data:image/svg+xml,${name}`,
    chains,
    accounts: [],
    calls,
    features: {
      'standard:connect': { version: '1.0.0', connect: async () => ({ accounts: [account] }) },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signTransaction: async (...inputs) => {
          calls.push(['sign', inputs]);
          return inputs.map((input) => ({ signedTransaction: Uint8Array.from([...input.transaction, 9]) }));
        },
      },
      ...(signAndSend
        ? {
            'solana:signAndSendTransaction': {
              version: '1.0.0',
              signAndSendTransaction: async (...inputs) => {
                calls.push(['send', inputs]);
                return inputs.map(() => ({ signature: Uint8Array.from([0, 0, 1]) }));
              },
            },
          }
        : {}),
    },
  };
  return wallet;
}

function register(win, wallet) {
  const callback = ({ register: add }) => add(wallet);
  win.dispatchEvent(detailEvent('wallet-standard:register-wallet', callback));
  win.addEventListener('wallet-standard:app-ready', ({ detail }) => callback(detail));
}

test('Solana: wallets registered before and after the page asks, Solana ones only', async () => {
  const win = new EventTarget();
  const phantom = standardWallet('Phantom', ['solana:mainnet', 'solana:devnet']);
  register(win, phantom); // before the page listens: it hears app-ready
  register(win, standardWallet('Sui Wallet', ['sui:mainnet']));
  assert.deepEqual(discoverSolanaWallets(win).map((w) => w.id), ['solana:phantom']);
  register(win, standardWallet('Solflare', ['solana:mainnet'], { signAndSend: false })); // after
  const wallets = discoverSolanaWallets(win);
  assert.deepEqual(
    wallets.map((w) => [w.id, w.name, w.ecosystem, w.canSignAndSend]),
    [
      ['solana:phantom', 'Phantom', 'solana', true],
      ['solana:solflare', 'Solflare', 'solana', false],
    ],
  );
  assert.deepEqual(discoverSolanaWallets(undefined), []);
});

test('Solana: connect, sign base64 in and out, sign and send', async () => {
  const win = new EventTarget();
  const phantom = standardWallet('Phantom', ['solana:mainnet']);
  register(win, phantom);
  const [wallet] = discoverSolanaWallets(win);
  assert.equal(await wallet.connect(), 'So1anaAccount1111111111111111111111111111111');
  const signed = await wallet.signTransaction(bytesToBase64(Uint8Array.from([1, 2, 3])), 'solana:devnet');
  assert.deepEqual([...base64ToBytes(signed)], [1, 2, 3, 9]);
  const [, [input]] = phantom.calls[0];
  assert.equal(input.chain, 'solana:devnet');
  assert.equal(input.account.address, 'So1anaAccount1111111111111111111111111111111');
  assert.equal(await wallet.signAndSendTransaction(bytesToBase64(Uint8Array.from([1]))), '112');
});

/** A Stellar adapter double. */
function adapter(id, name, available, signed = 'SIGNED') {
  const calls = [];
  return {
    id,
    name,
    calls,
    isAvailable: async () => available,
    getPublicKey: async (network) => {
      calls.push(['key', network]);
      return 'GAADDRESS';
    },
    signTransaction: async (xdr, params) => {
      calls.push(['sign', xdr, params]);
      return signed;
    },
  };
}

test('Stellar: available adapters, then the kit wallets they do not cover', async () => {
  const freighter = adapter('freighter', 'Freighter', true);
  const kitCalls = [];
  const kit = {
    getSupportedWallets: async () => [
      { id: 'freighter', name: 'Freighter', icon: 'https://kit/freighter.png', isAvailable: true },
      { id: 'hana', name: 'Hana Wallet', icon: 'https://kit/hana.png', isAvailable: true },
      { id: 'rabet', name: 'Rabet', icon: 'https://kit/rabet.png', isAvailable: false },
      { id: 'cosmos-wallet', name: 'Cosmos Pay Wallet', icon: 'https://kit/cosmos.png', isAvailable: true },
    ],
    setWallet: (id) => kitCalls.push(['set', id]),
    getAddress: async () => ({ address: 'GHANA' }),
    signTransaction: async (xdr, opts) => {
      kitCalls.push(['sign', xdr, opts]);
      return { signedTxXdr: 'KIT_SIGNED' };
    },
  };
  const wallets = await discoverStellarWallets({
    adapters: [freighter, adapter('xbull', 'xBull', false), adapter('cosmos', 'Cosmos Pay Wallet', true)],
    kit,
  });
  assert.deepEqual(
    wallets.map((w) => [w.id, w.name, w.icon]),
    [
      ['stellar:freighter', 'Freighter', 'https://kit/freighter.png'],
      ['stellar:cosmos', 'Cosmos Pay Wallet', 'https://kit/cosmos.png'],
      ['stellar:hana', 'Hana Wallet', 'https://kit/hana.png'],
    ],
  );
  assert.equal(await wallets[0].connect('testnet'), 'GAADDRESS');
  assert.equal(freighter.calls[0][1].passphrase, PASSPHRASES.testnet);
  assert.equal(await wallets[0].signTransaction('XDR', { network: 'public', address: 'GA' }), 'SIGNED');
  assert.deepEqual(freighter.calls[1], [
    'sign',
    'XDR',
    { network: 'public', networkPassphrase: PASSPHRASES.public, address: 'GA' },
  ]);
  const hana = wallets[2];
  assert.equal(await hana.connect('public'), 'GHANA');
  assert.equal(await hana.signTransaction('XDR2', { network: 'testnet' }), 'KIT_SIGNED');
  assert.deepEqual(kitCalls, [
    ['set', 'hana'],
    ['set', 'hana'],
    ['sign', 'XDR2', { networkPassphrase: PASSPHRASES.testnet, address: undefined }],
  ]);
});

test('Stellar: a v2 kit (static class): Freighter is Varial, fetchAddress asks the wallet', async () => {
  const freighter = adapter('freighter', 'Freighter', true);
  const calls = [];
  class Kit {
    static async refreshSupportedWallets() {
      return [
        { id: 'varial', name: 'Varial', icon: 'https://kit/varial.png', isAvailable: true },
        { id: 'metamask', name: 'MetaMask', icon: 'https://kit/metamask.png', isAvailable: true },
      ];
    }
    static setWallet(id) { calls.push(['set', id]); }
    static async getAddress() { throw { code: -1, message: 'No wallet has been connected.' }; }
    static async fetchAddress() { calls.push(['fetch', this === Kit]); return { address: 'GSNAP' }; }
    static async signTransaction() { return { signedTxXdr: 'SNAP_SIGNED', signerAddress: 'GSNAP' }; }
  }
  const wallets = await discoverStellarWallets({ adapters: [freighter], kit: Kit });
  assert.deepEqual(
    wallets.map((w) => [w.id, w.name, w.icon]),
    [
      ['stellar:freighter', 'Varial', 'https://kit/varial.png'],
      ['stellar:metamask', 'MetaMask', 'https://kit/metamask.png'],
    ],
  );
  assert.equal(await wallets[1].connect('public'), 'GSNAP');
  assert.deepEqual(calls, [['set', 'metamask'], ['fetch', true]]);
  const error = await wallets[1].signTransaction('', { network: 'public' }).then(() => null, (e) => e);
  assert.equal(error, null);
});

test('discoverWallets: one call, by ecosystem', async () => {
  const win = new EventTarget();
  announceOn(win, { uuid: 'u', name: 'MetaMask', rdns: 'io.metamask' }, fakeProvider({}));
  register(win, standardWallet('Backpack', ['solana:mainnet']));
  const all = await discoverWallets({
    window: win,
    timeoutMs: 5,
    stellar: { adapters: [adapter('freighter', 'Freighter', true)] },
  });
  assert.deepEqual(
    Object.fromEntries(Object.entries(all).map(([k, list]) => [k, list.map((w) => w.id)])),
    { stellar: ['stellar:freighter'], evm: ['evm:io.metamask'], solana: ['solana:backpack'] },
  );
  const evmOnly = await discoverWallets({ window: win, timeoutMs: 5, ecosystems: ['evm'] });
  assert.deepEqual([evmOnly.stellar.length, evmOnly.evm.length, evmOnly.solana.length], [0, 1, 0]);
});

test('encodings', () => {
  assert.equal(
    erc20TransferData('0x00000000000000000000000000000000000000AA', 1000000n),
    '0xa9059cbb' + '0'.repeat(62) + 'aa' + '0'.repeat(59) + 'f4240',
  );
  assert.throws(() => erc20TransferData('0x12', 1n), /Not an EVM address/);
  assert.equal(toQuantity('0'), '0x0');
  assert.equal(toQuantity('255'), '0xff');
  assert.equal(toQuantity('0x00ff'), '0xff');
  assert.equal(toQuantity(16n), '0x10');
  assert.throws(() => toQuantity('1.5'), /Not an amount of wei/);
  const max = (1n << 256n) - 1n;
  assert.equal(toQuantity(max), `0x${'f'.repeat(64)}`);
  assert.throws(() => toQuantity(max + 1n), /cannot exceed/);
  assert.throws(() => toQuantity(-1n), /negative/);
  assert.throws(() => erc20TransferData('0x00000000000000000000000000000000000000AA', max + 1n), /cannot exceed/);
  assert.throws(() => erc20TransferData('0x00000000000000000000000000000000000000AA', '1.5'), /base units/);
  assert.throws(
    () => parseEip681(`ethereum:0x754704Bc059F8C67012fEd69BC8A327a5aafb603@1/transfer?address=0x1111111111111111111111111111111111111111&uint256=${max + 1n}`),
    /cannot exceed/,
  );
  assert.equal(bytesToBase58(new TextEncoder().encode('hello world')), 'StV1DL6CwTryKyV');
  assert.equal(bytesToBase58(Uint8Array.from([0, 0, 1])), '112');
  const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i % 256);
  assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes);
});

test('EIP-681 deposit links as the transaction a wallet sends', () => {
  const to = '0x1111111111111111111111111111111111111111';
  const token = '0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
  assert.deepEqual(parseEip681(`ethereum:${to}@143?value=1500000000000000000`), {
    chainId: 143,
    to,
    value: '0x14d1120d7b160000',
  });
  assert.deepEqual(parseEip681(`ethereum:${token}@8453/transfer?address=${to}&uint256=2500000`), {
    chainId: 8453,
    to: token,
    data: erc20TransferData(to, 2500000n),
  });
  assert.deepEqual(parseEip681(`ethereum:${to}@1?value=2.5e18`).value, toQuantity('2500000000000000000'));
  assert.equal(parseEip681(`ethereum:${to}`).chainId, 1);
  assert.throws(() => parseEip681('web+stellar:pay?destination=G'), /Not an EIP-681/);
  assert.throws(() => parseEip681(`ethereum:${token}@1/approve?address=${to}&uint256=1`), /Unsupported/);
  assert.throws(() => parseEip681(`ethereum:${token}@1/transfer?uint256=1`), /no recipient/);
});

test('isUserRejection', () => {
  assert.ok(isUserRejection({ code: 4001, message: 'x' }));
  assert.ok(isUserRejection(new WalletError('stellar:freighter', 'User declined access')));
  assert.ok(isUserRejection(new Error('Transaction cancelled')));
  assert.ok(!isUserRejection(new Error('insufficient funds for gas')));
  assert.ok(!isUserRejection(undefined));
});
