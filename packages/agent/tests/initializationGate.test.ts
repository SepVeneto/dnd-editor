/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Runner } from '@openai/agents'
import {
  assistantMessage,
  functionCall,
  ScriptedModel,
} from '@openai/agents/testing'
import { createAgents } from '../src/agents.ts'
import { AGENT_TOOL_EXECUTION } from '../src/toolExecution.ts'

describe('initialization gate', () => {
  it('rejects every editor mutation before IR is generated', async () => {
    const editorCalls: string[] = []
    const { agent } = createAgents({
      api: {
        editor: {
          getCurrentEditor: () => ({ revision: 0, page: { list: [] } }),
          getWidgets: () => ({ catalogVersion: '1.0', widgets: [] }),
          getCapabilities: () => ({ catalogVersion: '1.0', widgets: [] }),
          validateDsl: () => ({ ok: true, issues: [] }),
          addNode: () => {
            editorCalls.push('add')
            return { ok: true }
          },
          applyDsl: () => {
            editorCalls.push('applyDsl')
            return { ok: true }
          },
          operateEditor: () => {
            editorCalls.push('operateEditor')
            return { ok: true }
          },
        },
      },
    })
    const model = new ScriptedModel([
      [functionCall('add_editor_node', {
        resourceId: 'missing',
      }, { callId: 'add-before-ir' })],
      [functionCall('update_editor_node', {
        uuid: 'node-1',
        style: { width: 100 },
      }, { callId: 'update-before-ir' })],
      [functionCall('delete_editor_node', {
        uuid: 'node-1',
        confirmToken: 'token',
      }, { callId: 'delete-before-ir' })],
      [assistantMessage('blocked')],
    ])
    const runner = new Runner({
      modelProvider: { getModel: () => model },
      toolExecution: AGENT_TOOL_EXECUTION,
    })

    const result = await runner.run(agent, '直接编辑', { context: {} })
    const outputs = (result.state as any).toJSON().generatedItems
      .map((item: any) => item.output)
      .filter(Boolean)

    assert.deepEqual(editorCalls, [])
    assert.equal(outputs.length, 3)
    assert.ok(outputs.every((output: unknown) =>
      JSON.stringify(output).includes('尚未生成 IR，禁止开始编辑'),
    ))
  })
})
