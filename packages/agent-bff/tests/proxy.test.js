/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import http from 'node:http'
import { after, before, describe, it } from 'node:test'
import { createAgentProxyServer } from '../src/proxy.js'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve(server.address().port)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

describe('agent BFF reverse proxy', () => {
  const requests = []
  let upstreamServer
  let upstreamPort
  let proxyServer
  let proxyPort

  before(async () => {
    upstreamServer = http.createServer((req, res) => {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => {
        requests.push({
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: Buffer.concat(chunks).toString(),
        })
        res.writeHead(201, {
          'content-type': 'application/json',
          'x-upstream-response': 'yes',
        })
        res.end(JSON.stringify({ ok: true }))
      })
    })

    upstreamPort = await listen(upstreamServer)
    proxyServer = createAgentProxyServer({
      upstream: `http://127.0.0.1:${upstreamPort}/diy-agent`,
    })
    proxyPort = await listen(proxyServer)
  })

  after(async () => {
    await close(proxyServer)
    await close(upstreamServer)
  })

  it('保留请求路径和查询参数，并补充部署前缀', async () => {
    const body = JSON.stringify({ model: 'test-model', stream: true })
    const response = await fetch(
      `http://127.0.0.1:${proxyPort}/v1/responses?trace=1`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'agent-user-id': 'user-1',
        },
        body,
      },
    )

    assert.equal(response.status, 201)
    assert.equal(response.headers.get('x-upstream-response'), 'yes')
    assert.deepEqual(await response.json(), { ok: true })

    assert.equal(requests.length, 1)
    assert.equal(requests[0].method, 'POST')
    assert.equal(requests[0].url, '/diy-agent/v1/responses?trace=1')
    assert.equal(requests[0].body, body)
    assert.equal(requests[0].headers['agent-user-id'], 'user-1')
    assert.equal(requests[0].headers.host, `127.0.0.1:${upstreamPort}`)
  })

  it('把根路径和上传接口转发到目标部署前缀下', async () => {
    await Promise.all([
      fetch(`http://127.0.0.1:${proxyPort}/`),
      fetch(`http://127.0.0.1:${proxyPort}/upload`, { method: 'POST' }),
    ])

    assert.deepEqual(
      requests.slice(1).map(request => request.url).sort(),
      ['/diy-agent/', '/diy-agent/upload'],
    )
  })
})
