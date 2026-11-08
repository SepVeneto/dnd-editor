/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  Agent,
  Runner,
  tool,
} from '@openai/agents'
import {
  assistantMessage,
  functionCall,
  ScriptedModel,
} from '@openai/agents/testing'
import { AGENT_TOOL_EXECUTION } from '../src/toolExecution.ts'

describe('agent tool execution', () => {
  it('后序工具可以读取前序工具写入的 Context', async () => {
    const emptyParameters = {
      type: 'object',
      properties: {},
      additionalProperties: false,
    }
    let dataSeenByEditor: unknown

    const checkScenario = tool({
      name: 'check_scenario',
      description: '写入业务缓存',
      parameters: emptyParameters,
      strict: false,
      async execute(_input, runContext) {
        await new Promise(resolve => setTimeout(resolve, 20))
        runContext.context.businessCache = [{ id: 7 }]
        return { ok: true }
      },
    })
    const mutationTool = tool({
      name: 'mutation_tool',
      description: '读取业务缓存',
      parameters: emptyParameters,
      strict: false,
      async execute(_input, runContext) {
        dataSeenByEditor = (runContext.context as { businessCache: unknown }).businessCache
        return { ok: true }
      },
    })
    const agent = new Agent({
      name: 'test-agent',
      model: 'test-model',
      tools: [checkScenario, mutationTool],
    })
    const model = new ScriptedModel([
      [
        functionCall('check_scenario', {}, { callId: 'check-1' }),
        functionCall('mutation_tool', {}, { callId: 'mutation-1' }),
      ],
      [assistantMessage('done')],
    ])
    const runner = new Runner({
      modelProvider: { getModel: () => model },
      toolExecution: AGENT_TOOL_EXECUTION,
    })

    await runner.run(agent, 'test', {
      context: { businessCache: [] },
    })

    assert.deepEqual(dataSeenByEditor, [{ id: 7 }])
  })
})
