import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { relay } from '../functions/[[path]].js'

let server
let baseUrl
let upstreamHost

// A tiny mock upstream that echoes request details back as JSON.
before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: `http://${req.headers.host}/landing` })
      return res.end()
    }
    if (req.url === '/setcookie') {
      res.writeHead(200, {
        'Set-Cookie': 'sid=abc; Domain=upstream.example.com; Path=/; HttpOnly',
        'Content-Type': 'text/plain',
      })
      return res.end('cookie set')
    }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(
        JSON.stringify({
          method: req.method,
          url: req.url,
          host: req.headers.host,
          xfh: req.headers['x-forwarded-host'],
          xfp: req.headers['x-forwarded-proto'],
          xff: req.headers['x-forwarded-for'] || null,
          custom: req.headers['x-custom'] || null,
          body,
        })
      )
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  upstreamHost = new URL(baseUrl).host
})

after(() => server.close())

test('forwards GET with query, path and forwarded headers', async () => {
  const res = await relay(new Request('https://pages.example.com/foo?a=1'), { TARGET_URL: baseUrl })
  assert.equal(res.status, 200)
  const data = await res.json()
  assert.equal(data.url, '/foo?a=1')
  assert.equal(data.method, 'GET')
  // The upstream sees its own host (fetch derives Host from the URL); the original
  // host is preserved via X-Forwarded-Host.
  assert.equal(data.host, upstreamHost)
  assert.equal(data.xfh, 'pages.example.com')
  assert.equal(data.xfp, 'https')
})

test('forwards custom request headers', async () => {
  const res = await relay(new Request('https://pages.example.com/h', { headers: { 'x-custom': 'v1' } }), {
    TARGET_URL: baseUrl,
  })
  const data = await res.json()
  assert.equal(data.custom, 'v1')
})

test('forwards POST body', async () => {
  const res = await relay(
    new Request('https://pages.example.com/api', { method: 'POST', body: 'hello', headers: { 'content-type': 'text/plain' } }),
    { TARGET_URL: baseUrl }
  )
  const data = await res.json()
  assert.equal(data.method, 'POST')
  assert.equal(data.body, 'hello')
})

test('honours a path prefix on TARGET_URL', async () => {
  const res = await relay(new Request('https://pages.example.com/foo'), { TARGET_URL: baseUrl + '/prefix' })
  const data = await res.json()
  assert.equal(data.url, '/prefix/foo')
})

test('returns 500 when TARGET_URL is missing', async () => {
  const res = await relay(new Request('https://pages.example.com/'), {})
  assert.equal(res.status, 500)
})

test('returns 500 when TARGET_URL is not a valid URL', async () => {
  const res = await relay(new Request('https://pages.example.com/'), { TARGET_URL: 'not a url' })
  assert.equal(res.status, 500)
})

test('rewrites Location back to the Pages domain', async () => {
  const res = await relay(new Request('https://pages.example.com/redirect'), { TARGET_URL: baseUrl })
  assert.equal(res.status, 302)
  assert.equal(res.headers.get('Location'), 'https://pages.example.com/landing')
})

test('strips the Domain attribute from Set-Cookie', async () => {
  const res = await relay(new Request('https://pages.example.com/setcookie'), { TARGET_URL: baseUrl })
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('Set-Cookie')]
  assert.equal(cookies.length, 1)
  assert.match(cookies[0], /sid=abc/)
  assert.ok(!/Domain=/i.test(cookies[0]), 'Domain attribute should be stripped')
})

test('answers the local health-check endpoint', async () => {
  const res = await relay(new Request('https://pages.example.com/__healthz'), {
    TARGET_URL: baseUrl,
    HEALTH_PATH: '/__healthz',
  })
  assert.equal(res.status, 200)
  assert.equal(await res.text(), 'ok')
})

test('appends client IP to X-Forwarded-For', async () => {
  const res = await relay(
    new Request('https://pages.example.com/xff', { headers: { 'CF-Connecting-IP': '203.0.113.7' } }),
    { TARGET_URL: baseUrl }
  )
  const data = await res.json()
  assert.equal(data.xff, '203.0.113.7')
})
