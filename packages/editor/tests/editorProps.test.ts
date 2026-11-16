/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { editorProps } from '../lib/props.ts'

describe('editor agent props', () => {
  it('默认允许 agent 保存本地会话历史', () => {
    assert.equal(editorProps.agentHistoryStorageEnabled.type, Boolean)
    assert.equal(editorProps.agentHistoryStorageEnabled.default, true)
  })
})
