# Changelog

All notable changes to @cosmosapp/pay_sdk are documented here.
Generated from [Conventional Commits](https://www.conventionalcommits.org) by [git-cliff](https://git-cliff.org).
## [2.0.0] - 2026-09-16

### Features
- Follow the payments API security contract changes (0e9ba8b)
- Update PollarManager documentation to clarify session handling and user registration requirements (d80aa11)
- Add dossierVersion and reviewedVersion to Receiver class and update approval logic (14689d1)

### Miscellaneous
- Bump @types/node in the minor-and-patch group across 1 directory (#7) (9a22af8)
- Bump @types/node in the minor-and-patch group (#9) (6a0dfe6)
- Relicense the SDK to Apache-2.0 (9653c3b)
- Bump @types/node in the minor-and-patch group (65f6819)

## [1.2.1] - 2026-08-19

### Bug Fixes
- Make payment examples network-safe (#8) (81f37b0)

## [1.2.0] - 2026-07-11

### Features
- Implement SwapManager and Swap structure, add swap functionality to Client, and enhance testing (12d3bbd)
- Derive the release bump from Conventional Commits (auto-versioning) (d43ccb7)

### Bug Fixes
- Sync src/util/Constants.ts version on release so tests pass (632c967)

### CI/CD
- Add Dependabot, unify changelog on git-cliff, modernize workflows (dae7b63)
- Fully automatic release on every push to main (skip when nothing to release) (8304ed7)

### Dependencies
- Update dependencies and fix the esbuild advisory (d3215c1)

## [1.0.1] - 2026-06-25


