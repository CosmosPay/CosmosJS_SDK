import { defineConfig } from 'tsup';

export default defineConfig({
  // Three entries: the server SDK (default), the browser/web client, and the
  // Stellar Wallets Kit module — separate so a dapp that only wants the kit module
  // does not pull the payments client in with it.
  entry: ['src/index.ts', 'src/web/index.ts', 'src/swk/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  target: 'node18',
  // The Stellar SDK is an optional peer dependency — the web client lazy-imports
  // it. Never bundle it; resolve it from the consumer's node_modules at runtime.
  external: ['@stellar/stellar-sdk'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
