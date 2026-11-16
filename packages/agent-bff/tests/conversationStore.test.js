/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createConversationStore,
  deriveConversationMetadata,
  normalizeNamespace,
  normalizeUserIdentity,
} from '../src/conversationStore.js'

describe('conversation store', () => {
  it('从聊天消息派生会话列表所需的标题和预览', () => {
    const metadata = deriveConversationMetadata({
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: '设计租房首页' }],
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: '已生成页面' }],
        },
      ],
    })

    assert.equal(metadata.title, '设计租房首页')
    assert.equal(metadata.preview, '设计租房首页')
    assert.equal(metadata.messageCount, 2)
  })

  it('规范化用户和命名空间', () => {
    assert.equal(normalizeUserIdentity(' user-1 '), 'user-1')
    assert.equal(normalizeUserIdentity(''), undefined)
    assert.equal(normalizeNamespace(''), 'dnd-agent-chat')
  })

  it('按用户和命名空间查询历史列表', async () => {
    let queryText = ''
    let queryValues = []
    const store = createConversationStore({
      async query(text, values) {
        queryText = text
        queryValues = values
        return { rows: [] }
      },
    })

    await store.list({
      userId: 'user-1',
      namespace: 'dnd-agent-chat',
      limit: 20,
    })

    assert.match(queryText, /WHERE user_id = \$1 AND namespace = \$2/)
    assert.deepEqual(queryValues, ['user-1', 'dnd-agent-chat', 20])
  })

  it('保存会话时使用用户作用域冲突更新', async () => {
    let queryText = ''
    let queryValues = []
    const store = createConversationStore({
      async query(text, values) {
        queryText = text
        queryValues = values
        return {
          rows: [{
            id: 'conversation-1',
            namespace: 'dnd-agent-chat',
            mode: 'data',
            title: '设计租房首页',
            preview: '设计租房首页',
            message_count: 1,
            created_at: '2026-11-16T01:00:00.000Z',
            updated_at: '2026-11-16T02:00:00.000Z',
          }],
        }
      },
    })

    const saved = await store.save({
      userId: 'user-1',
      namespace: 'dnd-agent-chat',
      id: 'conversation-1',
      mode: 'data',
      ...deriveConversationMetadata({
        messages: [{
          role: 'user',
          parts: [{ type: 'text', text: '设计租房首页' }],
        }],
      }),
    })

    assert.match(queryText, /agent_conversations\.user_id = EXCLUDED\.user_id/)
    assert.equal(queryValues[1], 'user-1')
    assert.equal(saved?.messageCount, 1)
  })
})
