# Installation

```bash
npm install @cosmosapp/pay_sdk
# or: pnpm add @cosmosapp/pay_sdk
# or: yarn add @cosmosapp/pay_sdk
```

Requires **Node.js ≥ 18** (for global `fetch`). On older runtimes pass a `fetch`
polyfill via the `fetch` client option.

## Browser web client (optional peer dependency)

The browser web client builds & submits Stellar transactions, so it needs the
Stellar SDK (an optional peer dependency, lazy-imported when present):

```bash
npm install @cosmosapp/pay_sdk @stellar/stellar-sdk
```

## Importing

```ts
// ESM
import { Client } from '@cosmosapp/pay_sdk';
import { WebClient } from '@cosmosapp/pay_sdk/web';
```

```js
// CommonJS
const { Client } = require('@cosmosapp/pay_sdk');
```

The package ships both ESM (`./dist/index.js`) and CJS (`./dist/index.cjs`) with
full type declarations.
