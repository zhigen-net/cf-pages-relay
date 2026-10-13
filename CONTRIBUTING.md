# Contributing

Thanks for taking the time to contribute! This is a deliberately small project, so the
bar for changes is "keep it tiny and tested."

## Getting started

```bash
cp .dev.vars.example .dev.vars   # set TARGET_URL to any upstream you control
npm run dev                      # local preview via wrangler pages dev
npm test                         # run the unit tests
```

## Guidelines

- **Keep it dependency-free.** The whole proxy is one file with no runtime dependencies.
  Add a dependency only if there is a very strong reason.
- **Tests are required for behavior changes.** Tests live in `test/relay.test.js` and run
  with the built-in Node test runner (`npm test`) — no install step.
- **Run the tests before opening a PR.** CI also runs them on every push/PR.
- Open an issue first for anything more than a trivial fix so we can agree on the approach.

## Releasing

The `main` branch is the source of truth. Pushing to `main` triggers the deploy workflow
(which requires the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` secrets).
