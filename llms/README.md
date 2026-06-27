# `llms/` — AI-readable docs for `@cosmosapp/pay_sdk`

This is an **isolated, atomic** documentation set designed to make integrating the
SDK much easier — both for developers and for the AI assistants they use (Cursor,
Copilot, Claude, ChatGPT, …). It is **not** part of the library's source code; it
ships alongside it purely as reference material.

## What's here

- **[`llms.txt`](./llms.txt)** — a concise, link-first index following the
  [llmstxt.org](https://llmstxt.org) convention. Point your AI tool at this first.
- **`00…14-*.md`** — atomic, self-contained topic files (overview, installation,
  payment intents, web client, webhooks, products/customers, analytics, assets,
  errors, configuration, types, recipes). Read only the ones a task needs.
- **[`llms-full.txt`](./llms-full.txt)** — every topic file concatenated into one
  document, for tools that prefer a single-file ingest. Generated from the `.md`
  files (do not edit by hand).

## How to use it

**As a developer:** open the topic file you need, or paste `llms.txt` /
`llms-full.txt` into your AI chat as context before asking it to write the
integration.

**With AI coding tools:** after `npm install @cosmosapp/pay_sdk`, this folder is
available at `node_modules/@cosmosapp/pay_sdk/llms/`. Add it to your tool's context
(e.g. Cursor "@Docs", a custom rule, or by copying `llms-full.txt`).

**Hosting:** you may also serve `llms.txt` at the root of your own site
(`/llms.txt`) so crawlers and assistants can discover how to use the SDK.

## Regenerating `llms-full.txt`

The `.md` files are the single source of truth. Rebuild the combined file with:

```bash
npm run llms
```

(runs `scripts/build-llms.mjs`).
