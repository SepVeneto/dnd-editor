import http from 'node:http'
import https from 'node:https'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const DEFAULT_AGENT_BFF_UPSTREAM = 'https://aibot.rxlpzj.com/diy-agent'

const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function normalizeUpstream(value) {
  const upstream = new URL(value)
  if (upstream.protocol !== 'http:' && upstream.protocol !== 'https:') {
    throw new TypeError('反向代理目标必须是 HTTP 或 HTTPS 地址')
  }
  upstream.pathname = upstream.pathname.replace(/\/+$/, '')
  upstream.search = ''
  upstream.hash = ''
  return upstream
}

function upstreamPath(upstream, requestURL = '/') {
  const queryIndex = requestURL.indexOf('?')
  const pathname = queryIndex === -1
    ? requestURL
    : requestURL.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : requestURL.slice(queryIndex)

  return `${upstream.pathname}${pathname.startsWith('/') ? pathname : `/${pathname}`}${query}`
}

function requestHeaders(req, upstream) {
  const headers = { ...req.headers }
  for (const name of hopByHopHeaders) {
    delete headers[name]
  }

  headers.host = upstream.host
  headers['x-forwarded-host'] = req.headers.host ?? ''
  headers['x-forwarded-proto'] = req.socket.encrypted ? 'https' : 'http'

  const forwardedFor = req.headers['x-forwarded-for']
  headers['x-forwarded-for'] = forwardedFor
    ? `${forwardedFor}, ${req.socket.remoteAddress ?? ''}`
    : req.socket.remoteAddress ?? ''

  return headers
}

function responseHeaders(headers) {
  const result = { ...headers }
  for (const name of hopByHopHeaders) {
    delete result[name]
  }
  return result
}

export function createAgentProxyServer(options = {}) {
  const upstream = normalizeUpstream(
    options.upstream ?? DEFAULT_AGENT_BFF_UPSTREAM,
  )
  const transport = upstream.protocol === 'https:' ? https : http

  return http.createServer((req, res) => {
    const upstreamRequest = transport.request({
      protocol: upstream.protocol,
      hostname: upstream.hostname,
      port: upstream.port || undefined,
      method: req.method,
      path: upstreamPath(upstream, req.url),
      headers: requestHeaders(req, upstream),
    }, (upstreamResponse) => {
      res.writeHead(
        upstreamResponse.statusCode ?? 502,
        responseHeaders(upstreamResponse.headers),
      )
      upstreamResponse.pipe(res)
    })

    upstreamRequest.on('error', (error) => {
      if (res.headersSent) {
        res.destroy(error)
        return
      }

      res.writeHead(502, {
        'access-control-allow-origin': '*',
        'content-type': 'application/json; charset=utf-8',
      })
      res.end(JSON.stringify({
        code: 1,
        msg: 'Agent BFF 反向代理请求失败',
      }))
    })

    req.on('aborted', () => upstreamRequest.destroy())
    req.pipe(upstreamRequest)
  })
}

function startAgentProxy(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 4000)
  const upstream = options.upstream
    ?? process.env.AGENT_BFF_UPSTREAM
    ?? DEFAULT_AGENT_BFF_UPSTREAM
  const server = createAgentProxyServer({ upstream })

  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`端口 ${port} 已被占用，请先停止本地 BFF 或其他监听该端口的进程`)
    }
    else {
      console.error('Agent BFF 反向代理启动失败:', error)
    }
    process.exitCode = 1
  })

  server.listen(port, options.host, () => {
    const address = server.address()
    const localPort = typeof address === 'object' && address
      ? address.port
      : port
    console.log(`Agent BFF proxy listening on :${localPort} -> ${upstream}`)
  })

  return server
}

const entryURL = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined

if (entryURL === import.meta.url) {
  const server = startAgentProxy()

  function shutdown() {
    server.close()
  }

  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}
