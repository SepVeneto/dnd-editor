/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Runner, user } from '@openai/agents'
import {
  assistantMessage,
  functionCall,
  ScriptedModel,
} from '@openai/agents/testing'
import { buildChecklistAgentInstructions } from '../src/agentInstructions.ts'
import { createAgents } from '../src/agents.ts'
import {
  buildDebugPrompt,
  createDebugInitializationStart,
} from '../src/debug.ts'
import { createEditorAgentContext } from '../src/editorContext.ts'
import { initializeEditorContext } from '../src/initialization.ts'
import { AGENT_TOOL_EXECUTION } from '../src/toolExecution.ts'

const catalog = {
  catalogVersion: '1.0',
  widgets: [{
    type: 'jgq',
    name: '金刚区',
    description: '',
    defaultData: {},
    defaultStyle: {},
    fields: [],
    customTypes: [],
    staticOptions: [],
  }],
}

describe('initialization debug mode', () => {
  it('uses manually supplied prepare input and exposes the host result to the model', async () => {
    const context = createEditorAgentContext()
    const debug = {
      startAt: 'prepare_initialization' as const,
      prepareInitialization: {
        intent: '手动 mock 的初始化目标',
        components: [{
          key: 'manual-entry',
          type: 'jgq',
        }],
        resources: [],
      },
    }

    const start = await createDebugInitializationStart(debug, context, {
      editor: {
        getCurrentEditor: () => ({
          revision: 12,
          page: { list: [] },
        }),
        getWidgets: () => catalog,
        getCapabilities: () => catalog,
        validateDsl: () => ({ ok: true, issues: [] }),
        applyDsl: () => ({ ok: true }),
        operateEditor: () => ({ ok: true }),
      },
    })

    assert.equal(start.result.ok, true)
    assert.equal(start.callId, (start.items[0] as any).callId)
    assert.deepEqual(
      JSON.parse((start.items[0] as any).arguments),
      debug.prepareInitialization,
    )
    assert.deepEqual(
      JSON.parse((start.items[1] as any).output),
      start.result,
    )

    const initialization = (context as any).initialization
    assert.equal(initialization.ir.baseDocRevision, 12)
    assert.equal(initialization.ir.intent, '手动 mock 的初始化目标')
    assert.equal(initialization.status, 'ready')
    assert.equal(
      initialization.ir.components[0].locationId,
      Object.keys(initialization.locations)[0],
    )
  })

  it('returns initialization failures without creating context', async () => {
    const context = createEditorAgentContext()
    const result = await initializeEditorContext({
      intent: '',
      components: [],
      resources: [],
    }, context, {
      editor: {
        getCurrentEditor: () => ({ revision: 3 }),
        getWidgets: () => catalog,
        getCapabilities: () => catalog,
        validateDsl: () => ({ ok: true, issues: [] }),
        applyDsl: () => ({ ok: true }),
        operateEditor: () => ({ ok: true }),
      },
    })

    assert.equal(result.ok, false)
    assert.equal(result.stage, 'ir')
    assert.equal((context as any).initialization, undefined)
  })

  it('continues the agent after the injected initialization result', async () => {
    const context = createEditorAgentContext()
    const addedLocations: string[] = []
    const api = {
      editor: {
        getCurrentEditor: () => ({ revision: 4 }),
        getWidgets: () => catalog,
        getCapabilities: () => catalog,
        validateDsl: () => ({ ok: true, issues: [] }),
        addNode: (operation: any) => {
          addedLocations.push(operation.locationId)
          return { ok: true, revision: 5 }
        },
        applyDsl: () => ({ ok: true }),
        operateEditor: () => ({ ok: true }),
      },
    }
    const start = await createDebugInitializationStart({
      startAt: 'prepare_initialization',
      prepareInitialization: {
        intent: '从手动初始化结果继续添加',
        components: [{
          key: 'manual-entry',
          type: 'jgq',
        }],
        resources: [],
      },
    }, context, api)
    assert.equal(start.result.ok, true)

    const locationId = (context as any).initialization.ir.components[0].locationId
    const { checklistAgent } = createAgents({
      api,
      debugStartAt: 'prepare_initialization',
    })
    const model = new ScriptedModel([
      [functionCall('add_editor_node', {
        resourceId: locationId,
      }, { callId: 'debug-add-1' })],
      [assistantMessage('调试添加完成')],
    ])
    const runner = new Runner({
      modelProvider: { getModel: () => model },
      toolExecution: AGENT_TOOL_EXECUTION,
    })

    await runner.run(
      checklistAgent,
      [...start.items, user('继续完成手动 IR')],
      { context },
    )

    assert.deepEqual(addedLocations, [locationId])
  })

  it('tells the checklist agent to continue after the mocked preparation', () => {
    const instructions = buildChecklistAgentInstructions({
      debugStartAt: 'prepare_initialization',
    })

    assert.match(instructions, /宿主已使用手动 mock 入参完成 prepare_initialization/)
    assert.match(instructions, /不要再次调用 get_current_editor、get_widgets 或 prepare_initialization/)
    assert.match(instructions, /手动 mock 入参不来自用户消息/)
    assert.doesNotMatch(
      buildChecklistAgentInstructions(),
      /宿主已使用手动 mock 入参完成 prepare_initialization/,
    )
    assert.match(buildDebugPrompt(), /不要解析用户消息/)
    assert.match(buildDebugPrompt(), /按 IR components 顺序执行组件操作/)
  })
})
