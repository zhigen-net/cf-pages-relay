# cf-pages-relay

> A tiny, zero-dependency Cloudflare Pages reverse proxy.

Point it at any upstream — typically a Cloudflare **Worker** that lives in a *different*
Cloudflare account — and `cf-pages-relay` serves that upstream from a custom domain you
own. It solves the well-known limitation that **a Worker cannot be bound to a domain that
resides in another Cloudflare account.**

---

## Why

Cloudflare Workers can only be attached to custom domains managed in the *same* account.
If your domain and your Worker are in two different accounts, you can't directly bind the
domain to the Worker.

`cf-pages-relay` deploys as a Cloudflare **Pages** project in the *domain-owning* account,
binds the domain there, and transparently forwards every request to your Worker (or any
HTTP upstream).

## Features

- Forwards path, query string, method, body, and headers unchanged
- Rewrites `Location` redirects so they stay on your own domain
- Strips the `Domain` attribute from `Set-Cookie` so cookies land on your domain
- Sets `X-Forwarded-Host` / `X-Forwarded-Proto` / `X-Forwarded-For`
- WebSocket upgrade (HTTP 101) passthrough
- Optional local health-check endpoint
- Zero dependencies, ~100 lines, fully unit-tested with `node --test`

## Quick start (Cloudflare dashboard)

1. In the **domain-owning** Cloudflare account → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Choose this repository and set the production branch to `main`.
3. Build settings: Framework preset `None`, Build command empty, Build output directory `dist`.
4. Add an environment variable `TARGET_URL` = your upstream, e.g.
   `https://my-worker.my-subdomain.workers.dev`.
5. Deploy. Once connected, **every push to `main` automatically triggers a new build & deploy** —
   no GitHub Actions or extra setup required. Then add your custom domain under **Custom domains**.

> After changing `TARGET_URL`, redeploy (or hit **Retry deployment**) for the change to take effect.

## Local development

```bash
npm install -g wrangler        # if you don't already have it
cp .dev.vars.example .dev.vars # then edit TARGET_URL
npm run dev                    # wrangler pages dev dist
```

`TARGET_URL` is read from `.dev.vars` locally and from the Pages environment variable in production.

## Configuration

| Variable      | Required | Default       | Description                                                              |
| ------------- | -------- | ------------- | ------------------------------------------------------------------------ |
| `TARGET_URL`  | yes      | —             | Upstream to forward to. May include a path prefix (e.g. `…/api`).        |
| `URL`         | fallback | —             | Used only if `TARGET_URL` is unset.                                      |
| `HEALTH_PATH` | no       | `/__healthz`  | Path of the local health-check endpoint (GET → `200 ok`).                |

## How it works

The catch-all Pages Function `functions/[[path]].js` builds the upstream URL from
`TARGET_URL` + the incoming path/query, copies the request headers (minus hop-by-hop
headers), attaches the forwarded headers, and calls `fetch`. The upstream response is
returned as-is except for the `Location` and `Set-Cookie` rewrites described above.
WebSocket upgrades (HTTP 101) are passed straight through.

> **Security:** this is a *fixed-target* reverse proxy — it only ever forwards to the single
> configured `TARGET_URL`. It is **not** an open proxy.

## Project structure

```
.
├── functions/
│   └── [[path]].js    # catch-all Pages Function — the entire proxy (testable via `relay()`)
├── dist/
│   └── _routes.json  # routes all paths to Pages Functions
├── test/
│   └── relay.test.js # unit tests for `node --test` (no dependencies)
├── wrangler.toml
├── .dev.vars.example
└── package.json
```

## Testing

```bash
npm test   # runs test/relay.test.js with `node --test` — no install needed
```

## Deploy (Cloudflare dashboard — no GitHub Actions needed)

This project is built and deployed **entirely from the Cloudflare dashboard**:

1. **Workers & Pages → Create → Pages → Connect to Git**, pick this repo, set the production
   branch to `main`, build output directory `dist`.
2. Add the `TARGET_URL` environment variable (plus `HEALTH_PATH` if you change it).
3. Push to `main` — Cloudflare builds and deploys automatically. To change `TARGET_URL`,
   edit the variable and **Retry deployment**.

You can also deploy manually from the CLI if you prefer:

```bash
wrangler pages deploy dist
```

> CI (`.github/workflows/ci.yml`) only runs the test suite on pull requests — it never
> deploys. Deployment stays in the Cloudflare dashboard.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Released under the [MIT License](./LICENSE).

---

## 简体中文

一个零依赖的 Cloudflare Pages 反向代理。把一个上游（通常是**另一个 Cloudflare 账号**下的
Worker）通过你自己的自定义域名暴露出来，解决「Worker 无法绑定其他 Cloudflare 账号下的域名」
的限制。它原样转发路径、参数、方法、请求体与请求头，并重写 `Location` 与 `Set-Cookie` 的
`Domain`，让 Cookie 和重定向都落在你的域名上，同时支持 WebSocket。仅约 100 行、零依赖、带
`node --test` 单元测试。

部署：在**拥有域名的** Cloudflare 账号里 **Workers & Pages → 创建 → Pages → 连接 Git**，选本仓库
→ 生产分支 `main` → 构建输出目录 `dist` → 添加环境变量 `TARGET_URL` 指向上游 → 绑定自定义域名。
连上 Git 后，**每次 push 到 `main` 都会自动触发 Cloudflare 构建部署**，全程在 CF 后台完成，无需
GitHub Actions。修改 `TARGET_URL` 后重新部署（或点「重试部署」）即可生效。本地开发 `cp
.dev.vars.example .dev.vars` 后 `npm run dev`。
