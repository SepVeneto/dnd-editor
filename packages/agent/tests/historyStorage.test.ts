/* eslint-disable test/no-import-node-test */
import type { AgentHistoryStorage } from '../src/historyStorage.ts'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  readStoredHistory,
  writeStoredHistory,
} from '../src/historyStorage.ts'

class MemoryStorage implements AgentHistoryStorage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe('agent local history storage', () => {
  it('按会话命名空间读写聊天历史', () => {
    const storage = new MemoryStorage()
    const messages = [{
      id: 'message-1',
      role: 'user' as const,
      parts: [{ type: 'text' as const, text: '生成首页' }],
    }]

    writeStoredHistory('agent-chat', 'data', 'session-1', messages, storage)

    assert.deepEqual(
      readStoredHistory('agent-chat', 'data', 'session-1', storage),
      messages,
    )
    assert.deepEqual(
      readStoredHistory('other-agent', 'data', 'session-1', storage),
      [],
    )
  })

  it('忽略损坏或非数组的历史数据', () => {
    const storage = new MemoryStorage()
    storage.setItem('agent-chat:data:broken', '{')
    storage.setItem('agent-chat:data:object', '{}')

    assert.deepEqual(
      readStoredHistory('agent-chat', 'data', 'broken', storage),
      [],
    )
    assert.deepEqual(
      readStoredHistory('agent-chat', 'data', 'object', storage),
      [],
    )
  })
})
