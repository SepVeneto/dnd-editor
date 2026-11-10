/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Agent, tool } from '@openai/agents'
import {
  buildMainAgentInstructions,
  MAIN_AGENT_NAME,
  RETURN_TO_MAIN_AGENT_TOOL_NAME,
} from '../src/agentInstructions.ts'
import { createAgents } from '../src/agents.ts'

describe('agent instructions', () => {
  it('主 Agent 只调度宿主提供的子 Agent，不持有编辑能力', () => {
    const instructions = buildMainAgentInstructions({
      subAgents: [{
        name: 'Layout Agent',
        description: '处理布局请求。',
      }],
    })

    assert.match(instructions, /只负责请求分诊和调度宿主提供的子 Agent/)
    assert.match(instructions, /自身不持有任何业务或编辑器工具/)
    assert.match(instructions, /Layout Agent: 处理布局请求/)
    assert.match(instructions, /不得编造 handoff 工具/)
    assert.doesNotMatch(instructions, /add_editor_node/)
    assert.doesNotMatch(instructions, /update_editor_node/)
    assert.doesNotMatch(instructions, /直接处理简单编辑/)
  })
})

describe('agent topology', () => {
  it('未注入子 Agent 时只创建无工具的主 Agent', () => {
    const { agent, subAgents, agents } = createAgents({})

    assert.equal(agent.name, MAIN_AGENT_NAME)
    assert.deepEqual(agent.tools, [])
    assert.deepEqual(agent.handoffs, [])
    assert.deepEqual(subAgents, [])
    assert.deepEqual(agents, [agent])
  })

  it('主 Agent 不持有宿主工具，只有宿主子 Agent 获得工具和 DSL', () => {
    const { agent, subAgents } = createAgents({
      subAgents: [{
        name: 'Layout Agent',
        instructions: '按宿主提供的布局规则执行。',
        handoffDescription: '处理复杂布局和多组件组织请求。',
        handoffToolName: 'handle_layout',
      }],
    })

    const [layoutAgent] = subAgents
    assert.equal(layoutAgent.name, 'Layout Agent')
    assert.deepEqual(agent.tools, [])
    assert.equal((agent.handoffs[0] as any).toolName, 'handle_layout')
    assert.equal(
      (layoutAgent.handoffs[0] as any).toolName,
      RETURN_TO_MAIN_AGENT_TOOL_NAME,
    )
    assert.deepEqual(
      layoutAgent.tools.map(item => item.name),
      [
        'get_current_editor',
        'get_widgets',
        'validate_editor_dsl',
        'apply_editor_dsl',
        'undo_editor_dsl',
      ],
    )
  })

  it('只读子 Agent 可以关闭自动注入的编辑器 DSL', () => {
    const { agent, subAgents } = createAgents({
      subAgents: [{
        name: 'Research Agent',
        instructions: '只做分析。',
        handoffDescription: '分析请求。',
        editorDsl: false,
      }],
    })

    assert.deepEqual(agent.tools, [])
    assert.deepEqual(subAgents[0].tools, [])
  })

  it('保留宿主直接提供的 SDK Agent，包括其工具和 handoff', () => {
    const nativeTool = tool({
      name: 'query_items',
      description: '查询条目',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      strict: false,
      async execute() {
        return '{}'
      },
    })
    const hostAgent = new Agent({
      name: 'Host Agent',
      handoffDescription: '处理宿主业务。',
      instructions: '处理宿主业务。',
      model: 'test-model',
      tools: [nativeTool],
    })
    const { agent, subAgents } = createAgents({
      subAgents: [hostAgent],
    })

    assert.deepEqual(agent.tools, [])
    assert.deepEqual(subAgents, [hostAgent])
    assert.deepEqual(hostAgent.tools, [nativeTool])
    assert.equal((agent.handoffs[0] as any).agent, hostAgent)
  })

  it('拒绝与主 Agent 冲突或彼此重复的子 Agent 名称', () => {
    assert.throws(
      () => createAgents({
        subAgents: [{
          name: MAIN_AGENT_NAME,
          instructions: '冲突',
          handoffDescription: '冲突',
        }],
      }),
      /子 Agent 名称重复或与主 Agent 冲突/,
    )
  })
})
