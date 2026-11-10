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
    assert.match(instructions, /移交后不要继续规划页面/)
    assert.match(instructions, /添加组件只能调用 add_editor_node/)
    assert.match(instructions, /get_widgets 返回的 widget 类型/)
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
        name: 'Layout Agent',
        instructions: '按宿主提供的布局规则执行。',
        handoffDescription: '处理复杂布局和多组件组织请求。',
        handoffToolName: 'handle_layout',
      }],
    } as any)

    const [layoutAgent] = subAgents
    assert.equal(layoutAgent.name, 'Layout Agent')
    assert.deepEqual(agents.map(item => item.name), [
      agent.name,
      layoutAgent.name,
    ])
    assert.equal(
      (agent.handoffs[0] as any).toolName,
      'handle_layout',
    )
    assert.equal(
      (layoutAgent.handoffs[0] as any).toolName,
      RETURN_TO_MAIN_AGENT_TOOL_NAME,
    )
    assert.equal(
      layoutAgent.tools.some(item => (item as any).name === 'add_editor_node'),
      true,
    )
    const addTool = layoutAgent.tools.find(
      item => (item as any).name === 'add_editor_node',
    ) as any
    assert.deepEqual(
      Object.keys(addTool.parameters.properties),
      ['widget', 'props', 'style', 'custom'],
    )
    assert.deepEqual(addTool.parameters.required, ['widget'])
    assert.equal(addTool.parameters.additionalProperties, false)
  })

  it('保留 SDK Agent 工具和宿主业务工具的原始能力', () => {
    const nativeTool = tool({
      name: 'classify_items',
      description: '分类条目',
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
      name: 'query_items',
      description: '查询条目',
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
      agent.tools.some(item => (item as any).name === 'query_items'),
      true,
    )
    assert.equal(subAgents[0].tools.includes(nativeTool), true)
    assert.equal(
      subAgents[0].tools.some(item => (item as any).name === 'query_items'),
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
