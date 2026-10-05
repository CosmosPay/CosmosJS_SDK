# @cosmosapp/pay_sdk — working agreement

Hand-written TypeScript SDK for the Cosmos Pay Payments API, built with tsup and published
to npm. `main` is the release branch (every push to it may publish); `dev` is where work lands.

## Commands

| Command | What it does |
| --- | --- |
| `npm run build` | `tsup` — three entries, ESM (`.js`) + CJS (`.cjs`) + `.d.ts`/`.d.cts`, sourcemaps, into `dist/` |
| `npm run typecheck` | `tsc --noEmit` over `src/` |
| `npm test` | `pretest` runs the build first, then `node --test` over the listed files |
| `npm run openapi:sync` | copies the server spec into `openapi/openapi.json` (from `OPENAPI_SRC`, else `../comos-pay-community-server/openapi/openapi.json`) |
| `npm run openapi:check` | exits 1 when that copy is stale; **skips with a warning when no source is reachable** |
| `npm run llms` | regenerates `llms/llms-full.txt` from `llms/NN-*.md` |
| `npm run changelog` | `git-cliff@2 -o CHANGELOG.md` using `cliff.toml` |

- **Tests import `dist/`, not `src/`.** That is why `pretest` builds; running `node --test`
  directly tests whatever stale build is lying around.
- **`test` and `test:watch` name every test file explicitly.** A new `test/*.test.mjs` runs
  nowhere — not locally, not in CI — until it is added to BOTH scripts. `test/helpers.mjs`
  is shared fixtures, not a suite.
- **`llms/llms-full.txt` is generated and nothing in CI regenerates it.** Edit the
  `llms/NN-*.md` files and run `npm run llms`, or the published concatenation goes stale.

## Entry points and layout

`tsup.config.ts` builds `src/index.ts`, `src/web/index.ts` and `src/swk/index.ts`, exported as
`.`, `./web` and `./swk`. They are separate so each audience pulls in only its own code.

- **`.`** — the server SDK. `src/client/Client.ts` owns a `src/rest/REST.ts` and one manager
  per API area in `src/managers/` (all extend `BaseManager.ts`); responses become classes in
  `src/structures/`. Errors in `src/errors/`, webhook signing in `src/util/Webhooks.ts`,
  shared types in `src/types/`, typed assets/wallets/addresses in `src/common/`.
- **`./web`** — the browser client (`src/web/WebClient.ts`): detects the user's Stellar wallet
  (`src/web/WalletRegistry.ts`, `src/web/adapters/`), turns a SEP-7 intent into a signable
  transaction, signs and optionally submits.
- **`./swk`** — `CosmosWalletModule` for Stellar Wallets Kit (`src/swk/CosmosWalletModule.ts`).
  It does not import the kit itself, so offering the wallet costs nothing to anyone who skips it.

Imports inside `src/` use the `@/` alias (`tsconfig.json` `paths`); there are no relative ones.

## `@stellar/stellar-sdk` is an optional peer and must stay external

It is a `peerDependency` marked optional and listed in tsup's `external`. `src/web/stellar.ts`
lazy-imports it with a specifier assembled at runtime (or takes an injected one via
`new WebClient({ stellarSdk })`). Bundling it, or importing it statically, would force the
Stellar SDK on every server user who never touches `./web`.

## TypeScript is held at 5.9.x

tsup's `dts: true` needs the programmatic compiler API: TS 7.0 (the native port) does not ship
one, and TS 6 breaks tsup's DTS worker (commit `d3215c1`). `test/openapi.test.mjs` also
`import ts from 'typescript'` to parse the managers, so it needs that API too.
`.github/dependabot.yml` has **no `ignore` rule** for `typescript`, so Dependabot will keep
opening TS 6/7 major PRs whose CI fails correctly. Close them — do not "fix" the build to make
one pass. Adding an `ignore` for `typescript` majors is the alternative; it has not been done.

## The OpenAPI contract is the server's, verbatim

`openapi/openapi.json` is the community server's generated spec, copied with no transform —
never edit it by hand, and never source it from the developer platform's docs copy (that one
rewrites auth for presentation). `test/openapi.test.mjs` statically reads every
`this.rest.<verb>()` / `this.api().<verb>()` call in `src/` and fails when:

- the SDK calls a method + path the spec does not serve (a renamed route would otherwise
  compile, ship, and 404 for every integrator);
- the spec serves an operation the SDK neither calls nor lists, with a reason, in
  `openapi/unsupported.json`;
- an entry in `unsupported.json` is now implemented, or no longer served.

A new server route is therefore a decision: wrap it, or add it to `unsupported.json` with why.
CI's `openapi` job runs `openapi:check` against the server repo's `main` (for `main`) or `dev`
(for everything else). Locally, `openapi:check` passing with no source configured proves nothing.

## Releasing

`.github/workflows/release.yml` runs on every push to `main`. `scripts/release-version.mjs`
derives the version from Conventional Commits since the last release tag: `!`/`BREAKING CHANGE`
major, `feat` minor, `fix`/`perf`/`refactor`/`revert` patch, and anything else (chore, docs,
ci, style, test, build) **no release at all** — so Dependabot's `chore`-prefixed bumps never
publish on their own, despite the comment in `.github/dependabot.yml` saying they patch. It then
typechecks, tests, builds, runs `npm audit --omit=dev --audit-level=low`, regenerates
`CHANGELOG.md` and the release notes with git-cliff, commits, publishes with
`npm publish --provenance`, tags `vX.Y.Z` and creates the GitHub Release.

- **Never bump the version by hand** unless you mean to force that exact version (it must be
  higher than everything on npm). The script also rewrites `version` in
  `src/util/Constants.ts`, and `test/client.test.mjs` asserts `Client.version` equals
  `package.json` — a bump in one place only fails the suite.
- **Commit messages decide the release.** `cliff.toml` filters unconventional commits out of
  the changelog, so a commit without a Conventional prefix ships but is never mentioned.
- `CHANGELOG.md` is generated; do not hand-edit it.

CI (`.github/workflows/ci.yml`) runs typecheck, build and test on Node 18, 20 and 22 — the
package declares `node >=18`, so no Node 20+ only API (e.g. `import.meta.dirname`) in `src/`
or `test/`.
