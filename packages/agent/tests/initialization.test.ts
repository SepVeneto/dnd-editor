/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { z } from 'zod'
import {
  buildInitializationAgentInstructions,
  buildInitializationInstructions,
  defineInitializationTool,
  findInitializationTool,
  INITIALIZATION_AGENT_NAME,
  INITIALIZATION_HANDOFF_TOOL_NAME,
  INITIALIZATION_RETURN_TOOL_NAME,
  INITIALIZATION_TOOL_ROLE,
} from '../src/initialization.ts'
import {
  defineAgentTool,
} from '../src/tool.ts'

describe('initialization tool', () => {
  it('通过固定角色识别宿主提供的初始化工具', () => {
    const tool = defineInitializationTool({
      name: 'confirm_initialization',
      description: '让用户确认初始化方式',
      parameters: z.object({
        checklistSummary: z.string().optional(),
      }),
      execute: async () => ({ confirmed: true }),
    })

    assert.equal(tool.role, INITIALIZATION_TOOL_ROLE)
    assert.equal(findInitializationTool([tool])?.name, 'confirm_initialization')
  })

  it('普通业务工具不会误命中初始化角色', () => {
    const tool = defineAgentTool({
      name: 'query_scenario',
      description: '查询场景',
      execute: async () => null,
    })

    assert.equal(findInitializationTool([tool]), undefined)
  })

  it('主 Agent 判断为初始化后移交子 Agent', () => {
    const instructions = buildInitializationInstructions({
      toolName: 'confirm_initialization',
      agentName: INITIALIZATION_AGENT_NAME,
    })

    assert.ok(instructions.some(line => line.includes(INITIALIZATION_HANDOFF_TOOL_NAME)))
    assert.ok(instructions.some(line => line.includes('不要直接调用 confirm_initialization')))
    assert.ok(instructions.some(line => line.includes('由模型自主设计') && line.includes('使用参考数据')))
    assert.ok(instructions.some(line => line.includes('mode=reference') && line.includes('referenceData')))
    assert.ok(instructions.some(line => line.includes('业务侧工具准备数据')))
    assert.ok(instructions.some(line => line.includes('增量修改不得调用')))
  })

  it('未提供初始化工具时要求模型先询问用户', () => {
    const instructions = buildInitializationInstructions()

    assert.ok(instructions.some(line => line.includes('先询问用户')))
    assert.ok(instructions.some(line => line.includes('参考数据 ID')))
  })

  it('初始化子 Agent 只允许指定工具并交还主 Agent', () => {
    const instructions = buildInitializationAgentInstructions(
      'confirm_initialization',
      'Diy Copilot',
    )

    assert.ok(instructions.some(line => line.includes('唯一可调用的业务工具是 confirm_initialization')))
    assert.ok(instructions.some(line => line.includes('不得调用任何编辑器工具、其他业务工具')))
    assert.ok(instructions.some(line => line.includes('自主设计和参考数据之间选择')))
    assert.ok(instructions.some(line => line.includes(INITIALIZATION_RETURN_TOOL_NAME)))
    assert.ok(instructions.some(line => line.includes('Diy Copilot')))
  })
})
