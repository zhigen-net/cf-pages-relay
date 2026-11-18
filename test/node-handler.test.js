import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { gzipSync } from 'node:zlib'
import { test } from 'node:test'
import { createHandler } from '../node-handler.js'

async function listen(t, handler) {
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  }))
  return `http://127.0.0.1:${server.address().port}`
}

test('Node entry point streams the request and compressed response and preserves multiple cookies', async (t) => {
  const upstream = await listen(t, async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const payload = gzipSync(JSON.stringify({
      method: req.method,
      path: req.url,
      host: req.headers.host,
      forwardedHost: req.headers['x-forwarded-host'],
      forwardedProto: req.headers['x-forwarded-proto'],
      body: Buffer.concat(chunks).toString(),
    }))
    res.writeHead(201, {
      'content-type': 'application/json',
      'content-encoding': 'gzip',
      'content-length': payload.length,
      'set-cookie': ['sid=1; Domain=example.org; Path=/', 'theme=dark; Path=/'],
    })
    res.end(payload)
  })
  const base = await listen(t, createHandler({ TARGET_URL: upstream + '/prefix' }))
  const response = await fetch(base + '/nested/a%2Fb?x=1&x=2', {
    method: 'POST',
    headers: {
      'x-forwarded-host': 'pages.example.org',
      'x-forwarded-proto': 'https',
    },
    body: 'hello\nworld',
  })
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('content-encoding'), 'gzip')
  assert.deepEqual(response.headers.getSetCookie(), ['sid=1; Path=/', 'theme=dark; Path=/'])
  assert.deepEqual(await response.json(), {
    method: 'POST',
    path: '/prefix/nested/a%2Fb?x=1&x=2',
    host: new URL(upstream).host,
    forwardedHost: 'pages.example.org',
    forwardedProto: 'https',
    body: 'hello\nworld',
  })
})

test('Node entry point rewrites redirects and serves health checks', async (t) => {
  const upstream = await listen(t, (_req, res) => {
    res.writeHead(302, { location: '/landing?x=1#section' }).end()
  })
  const base = await listen(t, createHandler({ TARGET_URL: upstream }))
  const response = await fetch(base + '/redirect', {
    redirect: 'manual',
    headers: {
      'x-forwarded-host': 'pages.example.org',
      'x-forwarded-proto': 'https',
    },
  })
  await response.text()
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://pages.example.org/landing?x=1#section')
  assert.equal(await (await fetch(base + '/__healthz')).text(), 'ok')
})

test('Node entry point returns 502 when the upstream disconnects', async (t) => {
  const upstream = await listen(t, (req) => req.socket.destroy())
  const base = await listen(t, createHandler({ TARGET_URL: upstream }))
  const response = await fetch(base)
  assert.equal(response.status, 502)
  assert.equal(await response.text(), 'Bad Gateway')
})
