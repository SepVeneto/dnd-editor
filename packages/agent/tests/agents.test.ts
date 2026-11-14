/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  Agent,
  getHandoff,
  Runner,
  tool,
  Usage,
} from '@openai/agents'
import { z } from 'zod'
import {
  buildMainAgentInstructions,
  MAIN_AGENT_NAME,
} from '../src/agentInstructions.ts'
import { createAgents } from '../src/agents.ts'
import { createEditorDslTools } from '../src/editorDsl.ts'

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
    assert.match(instructions, /收到控制权后不得再次移交给同一子 Agent/)
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

  it('保留宿主子 Agent 配置并增加返回主 Agent 的 handoff', () => {
    const queryTool = tool({
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
    const layoutAgent = new Agent({
      name: 'Layout Agent',
      handoffDescription: '处理复杂布局和多组件组织请求。',
      model: 'test-model',
      instructions: '按宿主提供的布局规则执行。',
      tools: [
        ...createEditorDslTools({}),
        queryTool,
      ],
    })
    const { agent, subAgents } = createAgents({
      subAgents: [layoutAgent],
    })

    assert.deepEqual(agent.tools, [])
    assert.notEqual(subAgents[0], layoutAgent)
    assert.equal(subAgents[0].name, layoutAgent.name)
    assert.equal(agent.handoffs[0], subAgents[0])
    assert.deepEqual(layoutAgent.handoffs, [])
    assert.deepEqual(
      subAgents[0].tools.map(item => item.name),
      [
        'get_current_editor',
        'get_widgets',
        'validate_editor_dsl',
        'apply_editor_dsl',
        'undo_editor_dsl',
        'query_items',
      ],
    )
    const returnHandoff = getHandoff(subAgents[0].handoffs[0])
    assert.equal(returnHandoff.toolName, 'transfer_back_to_main')
    assert.equal(returnHandoff.agent, agent)
  })

  it('宿主 Agent 的 outputType 和已有 handoff 保持不变', () => {
    const outputType = z.object({
      summary: z.string(),
      nodeIds: z.array(z.string()),
    })
    const helperAgent = new Agent({
      name: 'Helper Agent',
      handoffDescription: '辅助分析。',
      model: 'test-model',
      instructions: '辅助分析。',
    })
    const researchAgent = new Agent({
      name: 'Research Agent',
      handoffDescription: '分析页面结构。',
      model: 'test-model',
      instructions: '返回结构化的分析结果。',
      outputType,
      handoffs: [helperAgent],
    })
    const { agent, subAgents } = createAgents({
      subAgents: [researchAgent],
    })

    assert.equal(subAgents[0].outputType, outputType)
    assert.equal(researchAgent.handoffs[0], helperAgent)
    assert.equal(researchAgent.handoffs.length, 1)
    assert.equal(subAgents[0].handoffs.length, 2)
    assert.equal(subAgents[0].handoffs[0], helperAgent)
    const returnHandoff = getHandoff(subAgents[0].handoffs[1])
    assert.equal(returnHandoff.toolName, 'transfer_back_to_main')
    assert.equal(returnHandoff.agent, agent)
  })

  it('拒绝与主 Agent 冲突或彼此重复的子 Agent 名称', () => {
    const createAgent = (name: string) => new Agent({
      name,
      handoffDescription: name,
      model: 'test-model',
      instructions: name,
    })
    assert.throws(
      () => createAgents({
        subAgents: [createAgent(MAIN_AGENT_NAME)],
      }),
      /子 Agent 名称重复或与主 Agent 冲突/,
    )
    assert.throws(
      () => createAgents({
        subAgents: [
          createAgent('Layout Agent'),
          createAgent('Layout Agent'),
        ],
      }),
      /子 Agent 名称重复或与主 Agent 冲突/,
    )
  })

  it('子 Agent 完成任务后返回主 Agent', async () => {
    const pageAgent = new Agent({
      name: 'Page Agent',
      handoffDescription: '处理页面编辑。',
      model: 'test-model',
      instructions: '编辑页面。',
    })
    const { agent, subAgents } = createAgents({
      subAgents: [pageAgent],
    })
    let requestCount = 0
    const model = {
      async getResponse(request: {
        handoffs: Array<{ toolName: string }>
      }) {
        if (requestCount === 0) {
          assert.equal(request.handoffs[0].toolName, 'transfer_to_Page_Agent')
          requestCount++
          return {
            usage: new Usage(),
            output: [{
              type: 'function_call' as const,
              callId: 'handoff-to-page',
              name: 'transfer_to_Page_Agent',
              arguments: '{}',
            }],
          }
        }
        if (requestCount === 1) {
          assert.equal(request.handoffs[0].toolName, 'transfer_back_to_main')
          requestCount++
          return {
            usage: new Usage(),
            output: [{
              type: 'function_call' as const,
              callId: 'handoff-to-main',
              name: 'transfer_back_to_main',
              arguments: '{}',
            }],
          }
        }
        requestCount++
        return {
          usage: new Usage(),
          output: [{
            type: 'message' as const,
            role: 'assistant' as const,
            status: 'completed' as const,
            content: [{
              type: 'output_text' as const,
              text: '页面已更新。',
            }],
          }],
        }
      },
      async* getStreamedResponse() {},
    }
    agent.model = model
    subAgents[0].model = model

    const result = await new Runner({ tracingDisabled: true }).run(
      agent,
      '更新页面',
      { maxTurns: 10 },
    )

    assert.equal(requestCount, 3)
    assert.equal(result.lastAgent, agent)
    assert.equal(result.finalOutput, '页面已更新。')
  })
})
