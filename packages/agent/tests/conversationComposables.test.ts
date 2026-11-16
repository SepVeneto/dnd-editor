/* eslint-disable test/no-import-node-test */
import type {
  AgentConversation,
  AgentConversationSummary,
} from '../src/conversationStorage.ts'
import type { ChatMessage } from '../src/types.ts'
import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { effectScope, ref } from 'vue'
import { useConversationHistory } from '../src/composables/useConversationHistory.ts'
import { useConversationPersistence } from '../src/composables/useConversationPersistence.ts'

const originalFetch = globalThis.fetch
const messages: ChatMessage[] = [{
  id: 'message-1',
  role: 'user',
  parts: [{ type: 'text', text: '设计首页' }],
}]
const options = {
  baseURL: 'http://localhost:4000/v1',
  userId: 'user-1',
  namespace: 'dnd-agent-chat',
}
const summaries: AgentConversationSummary[] = [
  {
    id: 'conversation-new',
    namespace: 'dnd-agent-chat',
    mode: 'data',
    title: '新会话',
    preview: '新会话',
    messageCount: 1,
    createdAt: '2026-11-16T02:00:00.000Z',
    updatedAt: '2026-11-16T02:00:00.000Z',
  },
  {
    id: 'conversation-old',
    namespace: 'dnd-agent-chat',
    mode: 'data',
    title: '旧会话',
    preview: '旧会话',
    messageCount: 1,
    createdAt: '2026-11-16T01:00:00.000Z',
    updatedAt: '2026-11-16T01:00:00.000Z',
  },
]

function conversation(
  summary: AgentConversationSummary,
): AgentConversation {
  return { ...summary, messages }
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify({ code: 0, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('conversation composables', () => {
  it('加载指定会话并切换历史会话', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.endsWith('/v1/conversations'))
        return jsonResponse(summaries)
      const id = url.split('/').at(-1)
      return jsonResponse(conversation(
        summaries.find(item => item.id === id) ?? summaries[0]!,
      ))
    }
    const history = useConversationHistory({
      enabled: true,
      clientOptions: options,
      preferredSessionId: 'conversation-new',
    })

    await history.initialize()
    assert.equal(history.sessionId.value, 'conversation-new')
    assert.deepEqual(history.messages.value, messages)

    await history.switchTo('conversation-old')
    assert.equal(history.sessionId.value, 'conversation-old')
    assert.equal(
      history.conversations.value.some(
        conversation => conversation.id === 'conversation-old',
      ),
      true,
    )

    history.startNewSession('conversation-new-session')
    assert.equal(history.sessionId.value, 'conversation-new-session')
    assert.deepEqual(history.messages.value, [])
  })

  it('初始化时不自动显示最近会话', async () => {
    const requestedURLs: string[] = []
    globalThis.fetch = async (input) => {
      const url = String(input)
      requestedURLs.push(url)
      if (url.endsWith('/v1/conversations'))
        return jsonResponse(summaries)
      const id = url.split('/').at(-1)
      return jsonResponse(conversation(
        summaries.find(item => item.id === id) ?? summaries[0]!,
      ))
    }
    const history = useConversationHistory({
      enabled: true,
      clientOptions: options,
      preferredSessionId: '',
    })
    const initialSessionId = history.sessionId.value

    await history.initialize()

    assert.equal(history.sessionId.value, initialSessionId)
    assert.deepEqual(history.messages.value, [])
    assert.equal(requestedURLs.length, 0)

    await history.toggle()

    assert.equal(history.open.value, true)
    assert.equal(history.conversations.value.length, summaries.length)
    assert.equal(history.sessionId.value, initialSessionId)
    assert.deepEqual(history.messages.value, [])
  })

  it('串行持久化当前会话消息', async () => {
    let savedBody: Record<string, unknown> | undefined
    globalThis.fetch = async (_input, init) => {
      savedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
      return jsonResponse(summaries[0])
    }
    const scope = effectScope()
    const persistedMessages = ref<ChatMessage[]>(messages)
    const persistence = scope.run(() => useConversationPersistence({
      messages: persistedMessages,
      enabled: true,
      clientOptions: options,
      sessionId: 'conversation-new',
      mode: 'data',
    }))
    assert.ok(persistence)

    await persistence.flush()

    assert.equal(Array.isArray(savedBody?.messages), true)
    assert.equal(savedBody?.title, '设计首页')
    assert.equal(persistence.error.value, '')
    scope.stop()
  })
})
