/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { requireAgentUser } from '../src/agentUser.js'

function createResponse() {
  return {
    body: undefined,
    statusCode: 200,
    locals: {},
    json(body) {
      this.body = body
      return this
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
  }
}

describe('agent user middleware', () => {
  it('缺少 Agent-User-Id 时直接返回 401', () => {
    const response = createResponse()
    let nextCalled = false

    requireAgentUser(
      { get: () => undefined },
      response,
      () => {
        nextCalled = true
      },
    )

    assert.equal(nextCalled, false)
    assert.equal(response.statusCode, 401)
    assert.deepEqual(response.body, {
      code: 1,
      msg: '未授权访问',
    })
  })

  it('携带 Agent-User-Id 时写入用户作用域并放行', () => {
    const response = createResponse()
    let nextCalled = false
    const headers = new Map([
      ['agent-user-id', 'user-1'],
      ['x-agent-namespace', 'editor-agent'],
    ])

    requireAgentUser(
      { get: name => headers.get(name) },
      response,
      () => {
        nextCalled = true
      },
    )

    assert.equal(nextCalled, true)
    assert.deepEqual(response.locals.agentUser, {
      userId: 'user-1',
      namespace: 'editor-agent',
    })
  })
})
