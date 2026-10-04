// Same-chain swaps off Stellar (Jupiter, Kuru Flow) and cross-chain swaps (NEAR
// Intents). Offline: an injected `fetch` answers every call.
//
// The point of these tests is the shape the SDK hands back: a Stellar request
// still yields a `Swap`, a Solana or Monad one a `ChainSwap`, and nothing about
// the Stellar calls changed on the wire.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ChainSwap,
  Client,
  CrossChainSwap,
  CrossChainSwapStatus,
  Swap,
} from '../dist/index.js';
import { mockFetch } from './helpers.mjs';

function makeClient(handler) {
  const fetch = mockFetch(handler);
  const client = new Client({ apiKey: 'prod_test', baseURL: 'http://gw', fetch });
  return { client, fetch };
}

const SOL_WALLET = '13QkxhNMrTPxoCkRdYdJ65tFuwXPhL5gLS2Z5Nr6gjRK';
const USDC_SOL = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function fakeChainSwap(overrides = {}) {
  return {
    id: 'cs_1',
    chain: 'solana',
    network: 'public',
    provider: 'jupiter',
    status: 'PENDING',
    source: SOL_WALLET,
    sendAsset: 'native',
    sendAmount: '0.1',
    destAsset: USDC_SOL,
    destEstimated: '11.87',
    destMin: '11.81',
    feeBps: 50,
    feeAmount: '0.059',
    slippageBps: 50,
    path: [],
    transaction: { encoding: 'base64', data: 'AQAA', lastValidBlockHeight: 7 },
    approval: null,
    txHash: null,
    idempotencyKey: null,
    expiresAt: '2026-10-03T12:01:00.000Z',
    createdAt: '2026-10-03T12:00:00.000Z',
    updatedAt: '2026-10-03T12:00:00.000Z',
    ...overrides,
  };
}

function fakeStellarSwap(overrides = {}) {
  return {
    id: 'swap_1',
    status: 'PENDING',
    network: 'public',
    source: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    destination: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    sendAsset: 'native',
    sendAssetIssuer: null,
    sendAmount: '100',
    feeAmount: '0.5',
    feeBps: 50,
    swapAmount: '99.5',
    destAsset: 'USDC',
    destAssetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    destEstimated: '98.7',
    destMin: '97.0',
    slippageBps: 100,
    path: [],
    memo: null,
    xdr: 'AAAA',
    uri: 'web+stellar:tx?xdr=AAAA',
    txHash: 'ab'.repeat(32),
    qr: 'data:image/png;base64,AAAA',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function fakeCrossChainSwap(overrides = {}) {
  return {
    id: 'ccs_1',
    status: 'AWAITING_DEPOSIT',
    providerStatus: 'PENDING_DEPOSIT',
    network: 'public',
    originChain: 'stellar',
    originAsset: 'XLM',
    originContract: null,
    destinationChain: 'solana',
    destinationAsset: 'USDC',
    destinationContract: USDC_SOL,
    amountIn: '100',
    feeBps: 50,
    feeAmount: '0.5',
    amountOutEstimated: '22.18',
    amountOutMin: '21.96',
    slippageBps: 100,
    recipient: SOL_WALLET,
    refundTo: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
    depositAddress: 'GDJ4JZXZELZD737NVFORH4PSSQDWFDZTKW3AIDKHYQG23ZXBPDGGQBJK',
    depositMemo: '188866795',
    depositUri: 'web+stellar:pay?destination=GDJ4&memo=188866795&memo_type=MEMO_TEXT',
    qr: 'data:image/png;base64,AAAA',
    depositTxHash: null,
    amountOut: null,
    refundedAmount: null,
    originTxHashes: null,
    destinationTxHashes: null,
    timeEstimateSeconds: 22,
    correlationId: 'corr-1',
    quoteSignature: 'ed25519:sig',
    idempotencyKey: null,
    expiresAt: '2026-10-02T12:30:00.000Z',
    createdAt: '2026-10-02T12:00:00.000Z',
    updatedAt: '2026-10-02T12:00:00.000Z',
    ...overrides,
  };
}

// ── client.swaps with a chain ───────────────────────────────────────────────

test('a Solana swap comes back as a ChainSwap carrying the transaction to sign', async () => {
  const { client, fetch } = makeClient(() => fakeChainSwap());

  const swap = await client.swaps.create({
    chain: 'solana',
    amount: '0.1',
    sourceAssetCode: 'SOL',
    destAssetCode: USDC_SOL,
    source: SOL_WALLET,
  });

  assert.ok(swap instanceof ChainSwap);
  assert.ok(!(swap instanceof Swap));
  assert.equal(swap.provider, 'jupiter');
  assert.deepEqual(swap.transaction, {
    encoding: 'base64',
    data: 'AQAA',
    lastValidBlockHeight: 7,
  });
  assert.ok(swap.expiresAt instanceof Date);
  assert.equal(fetch.calls[0].body.chain, 'solana');
});

test('a request with no chain is the Stellar one, byte for byte, and yields a Swap', async () => {
  const { client, fetch } = makeClient(() => fakeStellarSwap());

  const swap = await client.swaps.create({
    amount: '100',
    destAssetCode: 'USDC',
    destAssetIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    source: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  });

  assert.ok(swap instanceof Swap);
  assert.ok(!('chain' in fetch.calls[0].body));
});

test('fetch tells a Stellar swap from a Monad one by the payload', async () => {
  const { client } = makeClient((url) =>
    url.endsWith('/cs_2')
      ? fakeChainSwap({
          id: 'cs_2',
          chain: 'monad',
          provider: 'kuru',
          transaction: { to: '0xb3e6', data: '0xce1e7030', value: '0', chainId: 143 },
          approval: { to: '0x7547', data: '0x095ea7b3', value: '0', chainId: 143 },
        })
      : fakeStellarSwap(),
  );

  const monad = await client.swaps.fetch('cs_2');
  const stellar = await client.swaps.fetch('swap_1');

  assert.ok(monad instanceof ChainSwap);
  assert.equal(monad.approval.chainId, 143);
  assert.ok(stellar instanceof Swap);
});

test('the list names its chain in the query and materializes that chain’s swaps', async () => {
  const { client, fetch } = makeClient(() => ({
    data: [fakeChainSwap()],
    total: 1,
    take: 20,
    skip: 0,
  }));

  const page = await client.swaps.list({ chain: 'solana', status: 'PENDING' });

  assert.match(fetch.calls[0].url, /chain=solana/);
  assert.ok(page.items[0] instanceof ChainSwap);
});

test('a ChainSwap submits signedTransaction and patches itself from the outcome', async () => {
  const { client, fetch } = makeClient((url) =>
    url.endsWith('/submit')
      ? {
          submitted: true,
          status: 'SUBMITTED',
          txHash: '5VER',
          swap: fakeChainSwap({ status: 'SUBMITTED', txHash: '5VER' }),
        }
      : fakeChainSwap(),
  );

  const swap = await client.swaps.fetch('cs_1');
  const outcome = await swap.submit({ signedTransaction: 'AQAB' });

  assert.deepEqual(fetch.calls[1].body, { signedTransaction: 'AQAB' });
  assert.equal(outcome.txHash, '5VER');
  assert.equal(swap.status, 'SUBMITTED');
  assert.equal(swap.txHash, '5VER');
});

// ── client.crossChainSwaps ──────────────────────────────────────────────────

test('assets unwraps the list; quote is a plain object', async () => {
  const { client, fetch } = makeClient((url) =>
    url.endsWith('/assets')
      ? { data: [{ chain: 'stellar', symbol: 'XLM', assetId: 'x', decimals: 7, contract: null }] }
      : { network: 'public', fee: { bps: 50, amount: '0.5', asset: 'XLM' } },
  );

  const assets = await client.crossChainSwaps.assets();
  const quote = await client.crossChainSwaps.quote({
    originChain: 'stellar',
    originAsset: 'XLM',
    destinationChain: 'solana',
    destinationAsset: 'USDC',
    amount: '100',
    recipient: SOL_WALLET,
    refundTo: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  });

  assert.equal(assets[0].symbol, 'XLM');
  assert.equal(quote.fee.bps, 50);
  assert.match(fetch.calls[1].url, /\/v1\/cross-chain-swaps\/quote$/);
});

test('create yields a CrossChainSwap with the deposit to make', async () => {
  const { client } = makeClient(() => fakeCrossChainSwap());

  const swap = await client.crossChainSwaps.create({
    originChain: 'stellar',
    originAsset: 'XLM',
    destinationChain: 'solana',
    destinationAsset: 'USDC',
    amount: '100',
    recipient: SOL_WALLET,
    refundTo: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  });

  assert.ok(swap instanceof CrossChainSwap);
  assert.equal(swap.depositMemo, '188866795');
  assert.match(swap.depositUri, /memo_type=MEMO_TEXT/);
  assert.equal(swap.isFinal, false);
});

test('reportDeposit posts the hash and moves the instance forward', async () => {
  const { client, fetch } = makeClient((url) =>
    url.endsWith('/deposit')
      ? fakeCrossChainSwap({ status: 'DEPOSIT_DETECTED', depositTxHash: 'ab'.repeat(32) })
      : fakeCrossChainSwap(),
  );

  const swap = await client.crossChainSwaps.fetch('ccs_1');
  await swap.reportDeposit('ab'.repeat(32));

  assert.deepEqual(fetch.calls[1].body, { txHash: 'ab'.repeat(32) });
  assert.equal(swap.status, CrossChainSwapStatus.DepositDetected);
});

test('a refunded swap is final', async () => {
  const { client } = makeClient(() => ({
    data: [fakeCrossChainSwap({ status: 'REFUNDED', qr: undefined })],
    total: 1,
    take: 20,
    skip: 0,
  }));

  const page = await client.crossChainSwaps.list({ status: 'REFUNDED' });

  assert.equal(page.items[0].isFinal, true);
  assert.equal(page.items[0].qr, null);
});
