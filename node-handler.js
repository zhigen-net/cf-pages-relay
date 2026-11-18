import http from 'node:http'
import https from 'node:https'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { relay } from './functions/[[path]].js'

// Use Node's HTTP transport to preserve upstream compression and stream
// bytes unchanged. Node fetch decodes compressed bodies automatically.
function fetchUpstream(url, { method, headers, body, signal }) {
  const transport = new URL(url).protocol === 'https:' ? https : http

  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method,
      headers: Object.fromEntries(headers),
      signal,
    }, (response) => {
      const status = response.statusCode
      const noBody = method === 'HEAD' || [204, 205, 304].includes(status)
      if (noBody) response.resume()

      resolve(new Response(noBody ? null : Readable.toWeb(response), {
        status,
        headers: Object.entries(response.headersDistinct).flatMap(([name, values]) =>
          values.map((value) => [name, value])),
      }))
    })
    request.on('error', reject)
    if (body) {
      pipeline(Readable.fromWeb(body), request).catch(reject)
    } else {
      request.end()
    }
  })
}

export function createHandler(env = process.env) {
  return async function handleRequest(req, res) {
    const abort = new AbortController()
    res.once('close', () => {
      if (!res.writableFinished) abort.abort()
    })

    try {
      const forwardedHost = req.headers['x-forwarded-host']?.split(',')[0]?.trim()
      const host = forwardedHost || req.headers.host || 'localhost'
      const forwardedProto = req.headers['x-forwarded-proto']?.split(',')[0]?.trim()
      const protocol = forwardedProto === 'https' || req.socket.encrypted ? 'https' : 'http'
      const url = new URL(`${protocol}://${host}`)
      // Keep paths beginning with // on the original host.
      const request = new Request(url.origin + req.url, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
        duplex: 'half',
        signal: abort.signal,
      })
      const response = await relay(request, env, fetchUpstream)

      for (const [name, value] of response.headers) {
        if (name !== 'set-cookie') res.setHeader(name, value)
      }
      const cookies = response.headers.getSetCookie()
      if (cookies.length) res.setHeader('Set-Cookie', cookies)
      res.statusCode = response.status
      if (response.body) {
        await pipeline(Readable.fromWeb(response.body), res)
      } else {
        res.end()
      }
    } catch {
      if (res.destroyed) return
      if (res.headersSent) {
        res.destroy()
        return
      }
      for (const name of res.getHeaderNames()) res.removeHeader(name)
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Bad Gateway')
    }
  }
}
