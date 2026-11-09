/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { tool } from '@openai/agents'
import {
  buildMainAgentInstructions,
  MAIN_AGENT_NAME,
  RETURN_TO_MAIN_AGENT_TOOL_NAME,
} from '../src/agentInstructions.ts'
import { createAgents } from '../src/agents.ts'

describe('agent instructions', () => {
  it('主 Agent 只处理简单命令，并仅向宿主注入的子 Agent 移交', () => {
    const instructions = buildMainAgentInstructions()

    assert.match(instructions, /宿主可能为本次运行提供专业子 Agent/)
    assert.match(instructions, /handoffDescription/)
    assert.match(instructions, /不得假设存在宿主未注入的子 Agent/)
    assert.match(instructions, /简单命令/)
    assert.doesNotMatch(instructions, /Configuration Checklist Agent/)
    assert.doesNotMatch(instructions, /handle_configuration_checklist/)
    assert.doesNotMatch(instructions, /配置清单请求/)
    assert.match(instructions, /移交后不要继续规划页面/)
    assert.match(instructions, /任何 add\/edit\/delete\/move 前都必须先调用 prepare_initialization 生成 IR/)
    assert.match(instructions, /添加组件只能调用 add_editor_node/)
    assert.match(instructions, /只传 IR 中该位置的 resourceId/)
    assert.match(instructions, /不得传 widget、items 或 changes/)
  })
})

describe('agent topology', () => {
  it('未注入子 Agent 时编辑器只创建主 Agent', () => {
    const { agent, subAgents, agents } = createAgents({
      api: {},
    } as any)

    assert.equal(agent.name, MAIN_AGENT_NAME)
    assert.deepEqual(subAgents, [])
    assert.deepEqual(agents, [agent])
    assert.deepEqual(agent.handoffs, [])
  })

  it('由宿主注入专业子 Agent，并建立双向 handoff', () => {
    const { agent, subAgents, agents } = createAgents({
      api: {},
      subAgents: [{
        name: 'Configuration Checklist Agent',
        instructions: '按宿主提供的配置清单规则执行。',
        handoffDescription: '处理配置清单、需求文档和多组件配置请求。',
        handoffToolName: 'handle_configuration_checklist',
      }],
    } as any)

    const [checklistAgent] = subAgents
    assert.equal(checklistAgent.name, 'Configuration Checklist Agent')
    assert.deepEqual(agents.map(item => item.name), [
      agent.name,
      checklistAgent.name,
    ])
    assert.equal(
      (agent.handoffs[0] as any).toolName,
      'handle_configuration_checklist',
    )
    assert.equal(
      (checklistAgent.handoffs[0] as any).toolName,
      RETURN_TO_MAIN_AGENT_TOOL_NAME,
    )
    assert.equal(
      checklistAgent.tools.some(item => (item as any).name === 'add_editor_node'),
      true,
    )
    const addTool = checklistAgent.tools.find(
      item => (item as any).name === 'add_editor_node',
    ) as any
    assert.deepEqual(Object.keys(addTool.parameters.properties), ['resourceId'])
    assert.deepEqual(addTool.parameters.required, ['resourceId'])
    assert.equal(addTool.parameters.additionalProperties, false)
  })

  it('保留 SDK Agent 工具和宿主业务工具的原始能力', () => {
    const nativeTool = tool({
      name: 'classify_resources',
      description: '分类资源',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string' },
        },
        required: ['content'],
        additionalProperties: false,
      },
      strict: true,
      async execute() {
        return '{}'
      },
    })
    const hostDefinition = {
      kind: 'agent-tool' as const,
      name: 'query_resources',
      description: '查询资源',
      async execute() {
        return { ok: true }
      },
    }
    const { agent, subAgents } = createAgents({
      api: {},
      tools: [nativeTool, hostDefinition],
      subAgents: [{
        name: 'Resource Agent',
        instructions: '处理资源查询。',
        handoffDescription: '处理资源查询任务。',
      }],
    } as any)

    assert.equal(agent.tools.includes(nativeTool), true)
    assert.equal(
      agent.tools.some(item => (item as any).name === 'query_resources'),
      true,
    )
    assert.equal(subAgents[0].tools.includes(nativeTool), true)
    assert.equal(
      subAgents[0].tools.some(item => (item as any).name === 'query_resources'),
      true,
    )
  })

  it('拒绝与主 Agent 冲突或彼此重复的子 Agent 名称', () => {
    assert.throws(
      () => createAgents({
        api: {},
        subAgents: [{
          name: MAIN_AGENT_NAME,
          instructions: '冲突',
          handoffDescription: '冲突',
        }],
      } as any),
      /子 Agent 名称重复或与主 Agent 冲突/,
    )
  })
})
