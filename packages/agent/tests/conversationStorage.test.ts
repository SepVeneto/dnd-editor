/* eslint-disable test/no-import-node-test */
import type { ChatMessage } from '../src/types.ts'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  conversationPreview,
  conversationTitle,
  listAgentConversations,
  saveAgentConversation,
} from '../src/conversationStorage.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const messages: ChatMessage[] = [
  {
    id: 'message-1',
    role: 'user',
    parts: [{ type: 'text', text: '生成一个房源首页' }],
  },
  {
    id: 'message-2',
    role: 'assistant',
    parts: [{ type: 'text', text: '好的，正在处理。' }],
  },
]

const options = {
  baseURL: 'http://localhost:4000/v1',
  userId: 'user-1',
  namespace: 'dnd-agent-chat',
}

describe('agent conversation API client', () => {
  it('从消息中生成稳定的标题和预览', () => {
    assert.equal(conversationTitle(messages), '生成一个房源首页')
    assert.equal(conversationPreview(messages), '生成一个房源首页')
  })

  it('按用户和命名空间读取历史会话', async () => {
    let request: Request | undefined
    globalThis.fetch = async (input, init) => {
      request = new Request(input, init)
      return new Response(JSON.stringify({
        code: 0,
        data: [{
          id: 'conversation-1',
          namespace: 'dnd-agent-chat',
          mode: 'data',
          title: '生成一个房源首页',
          preview: '生成一个房源首页',
          messageCount: 2,
          createdAt: '2026-11-16T01:00:00.000Z',
          updatedAt: '2026-11-16T02:00:00.000Z',
        }],
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const conversations = await listAgentConversations(options)

    assert.equal(
      request?.url,
      'http://localhost:4000/v1/conversations',
    )
    assert.equal(request?.headers.get('agent-user-id'), 'user-1')
    assert.equal(request?.headers.get('x-agent-namespace'), 'dnd-agent-chat')
    assert.equal(conversations[0]?.messageCount, 2)
  })

  it('将会话消息写入 BFF', async () => {
    let body: Record<string, unknown> | undefined
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init)
      body = await request.json() as Record<string, unknown>
      return new Response(JSON.stringify({
        code: 0,
        data: {
          id: 'conversation-1',
          namespace: 'dnd-agent-chat',
          mode: 'data',
          title: '生成一个房源首页',
          preview: '生成一个房源首页',
          messageCount: 2,
          createdAt: '2026-11-16T01:00:00.000Z',
          updatedAt: '2026-11-16T02:00:00.000Z',
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await saveAgentConversation(options, {
      id: 'conversation-1',
      mode: 'data',
      messages,
    })

    assert.equal(body?.title, '生成一个房源首页')
    assert.equal(body?.preview, '生成一个房源首页')
    assert.deepEqual(body?.messages, messages)
  })
})
