// Cloudflare Pages reverse proxy.
//
// Forwards every incoming request to a fixed upstream (TARGET_URL) and returns the
// upstream response with host/cookie rewrites, so the site behaves as if it were
// served same-origin from the Pages domain.
//
// This file is intentionally self-contained (no imports outside `functions/`) so it
// bundles cleanly on Cloudflare Pages. `relay()` is also exported so it can be
// unit-tested in plain Node with `node --test` (it only uses web-standard APIs).

// Headers that must never be forwarded (hop-by-hop / connection-specific).
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

/**
 * Forward `request` to the configured upstream and return the (rewritten) response.
 * @param {Request} request
 * @param {Record<string,string>} [env] Bindings/env variables.
 * @returns {Promise<Response>}
 */
export async function relay(request, env = {}) {
  const target = env.TARGET_URL || env.URL
  if (!target) {
    return new Response('Missing required environment variable TARGET_URL', { status: 500 })
  }

  let base
  try {
    base = new URL(target)
  } catch {
    return new Response('TARGET_URL is not a valid URL: ' + target, { status: 500 })
  }

  const incoming = new URL(request.url)

  // Optional health-check endpoint, answered locally and never forwarded upstream.
  const healthPath = env.HEALTH_PATH || '/__healthz'
  if (request.method.toUpperCase() === 'GET' && incoming.pathname === healthPath) {
    return new Response('ok', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }

  const upstream = new URL(base.origin)
  upstream.pathname = base.pathname.replace(/\/+$/, '') + incoming.pathname
  upstream.search = incoming.search

  const headers = new Headers(request.headers)
  for (const h of HOP_BY_HOP) headers.delete(h)

  headers.set('X-Forwarded-Host', incoming.host)
  headers.set('X-Forwarded-Proto', incoming.protocol.replace(':', ''))

  const ip = request.headers.get('CF-Connecting-IP')
  if (ip) {
    const prior = headers.get('X-Forwarded-For')
    headers.set('X-Forwarded-For', prior ? `${prior}, ${ip}` : ip)
  }

  const method = request.method.toUpperCase()
  const hasBody = method !== 'GET' && method !== 'HEAD'
  if (!hasBody) headers.delete('content-length')

  const response = await fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
    // Required by Node's fetch (undici) when streaming a request body.
    duplex: hasBody ? 'half' : undefined,
  })

  // WebSocket upgrade: pass the 101 response straight through.
  if (response.status === 101) return response

  const out = new Response(response.body, response)

  // Rewrite redirects that point back at the upstream host to the current host,
  // so Location headers stay on the Pages domain.
  const location = out.headers.get('Location')
  if (location) {
    try {
      const loc = new URL(location, upstream)
      if (loc.host === base.host) {
        const rewritten = new URL(incoming.origin)
        rewritten.pathname = loc.pathname
        rewritten.search = loc.search
        out.headers.set('Location', rewritten.toString())
      }
    } catch {
      // Not a parseable URL — leave it untouched.
    }
  }

  // Drop the Domain attribute so cookies are scoped to the current domain.
  const cookies =
    typeof out.headers.getSetCookie === 'function' ? out.headers.getSetCookie() : []
  if (cookies.length) {
    out.headers.delete('Set-Cookie')
    for (const c of cookies) {
      out.headers.append('Set-Cookie', c.replace(/;\s*Domain=[^;]*/i, ''))
    }
  }

  return out
}

export async function onRequest(context) {
  return relay(context.request, context.env)
}
