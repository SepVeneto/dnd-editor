/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildAgentInstructions,
  buildMainAgentInstructions,
  CONFIG_CHECKLIST_AGENT_NAME,
  CONFIG_CHECKLIST_HANDOFF_TOOL_NAME,
  CONFIG_CHECKLIST_RETURN_TOOL_NAME,
} from '../src/agentInstructions.ts'
import { createAgents } from '../src/agents.ts'

describe('agent instructions', () => {
  it('主 Agent 只处理简单命令，并将配置清单移交子 Agent', () => {
    const instructions = buildMainAgentInstructions()

    assert.match(instructions, /配置清单请求/)
    assert.match(instructions, /简单命令/)
    assert.match(instructions, new RegExp(CONFIG_CHECKLIST_HANDOFF_TOOL_NAME))
    assert.match(instructions, new RegExp(CONFIG_CHECKLIST_AGENT_NAME))
    assert.match(instructions, /不要把.*升级为配置清单任务/)
    assert.match(instructions, /移交后不要继续规划页面/)
    assert.match(instructions, /任何 add\/edit\/delete\/move 前都必须先调用 prepare_initialization 生成 IR/)
    assert.match(instructions, /添加组件只能调用 add_editor_node/)
    assert.match(instructions, /只传 IR 中该位置的 resourceId/)
    assert.match(instructions, /不得传 widget、items 或 changes/)
  })

  it('配置清单严格按 IR、资源解析和直接 DSL 工具调用执行', () => {
    const instructions = buildAgentInstructions()

    assert.match(instructions, /任何 add\/update\/delete 前必须调用 prepare_initialization 生成 IR/)
    assert.match(instructions, /没有 IR 时禁止开始编辑/)
    const irIndex = instructions.indexOf('调用 prepare_initialization 提交 IR')
    const queryIndex = instructions.indexOf('宿主注册的独立工具 query_app_resources')
    const dslIndex = instructions.indexOf('IR components 是唯一的组件操作清单')
    const addIndex = instructions.indexOf('逐个调用 add_editor_node')

    assert.ok(irIndex >= 0)
    assert.ok(queryIndex > irIndex)
    assert.ok(dslIndex > queryIndex)
    assert.ok(addIndex > dslIndex)
    assert.match(instructions, /query_app_resources、query_coupon_resources、query_link_resources/)
    assert.match(instructions, /宿主注册的独立工具/)
    assert.match(instructions, /按 locationId 把标准属性状态和结果写入该位置的 Context 记录/)
    assert.match(instructions, /status=hold 时必须停止写入/)
    assert.match(instructions, /components 数组顺序就是页面组件顺序/)
    assert.match(instructions, /禁止生成 placement、afterKey、beforeKey、group/)
    assert.match(instructions, /add 的顺序必须与 IR components 数组顺序一致/)
    assert.match(instructions, /add 不再声明 placement/)
    assert.match(instructions, /IR components 是唯一的组件操作清单/)
    assert.match(instructions, /不存在资源槽位或槽位校验步骤/)
    assert.doesNotMatch(instructions, /apply_editor_dsl/)
    assert.doesNotMatch(instructions, /preview_editor_dsl/)
    assert.match(instructions, /模型直接调用编辑器 DSL 工具/)
  })

  it('本轮忽略参考图，并禁止模型生成业务实体和原始 items', () => {
    const instructions = buildAgentInstructions()

    assert.match(instructions, /本轮忽略图片和参考图的视觉解析/)
    assert.match(instructions, /不得生成业务实体 ID、items 或原始领域对象/)
    assert.match(instructions, /resources 中每项只填写 component、type、required、query/)
    assert.match(instructions, /禁止生成资源 ID、sources、hint、classification 或 resolution/)
    assert.match(instructions, /type 只能取 link\/app\/coupon/)
    assert.match(instructions, /宿主查询工具严格匹配/)
    assert.match(instructions, /按 locationId 把标准属性状态和结果写入该位置的 Context 记录/)
    assert.match(instructions, /H5 外接场景统一归类为 app 资源/)
    assert.match(instructions, /卡券品牌统一归类为 coupon 资源/)
    assert.match(instructions, /只解析品牌名称列/)
    assert.match(instructions, /卡片名称、面值、手续费等其它列全部忽略/)
    assert.match(instructions, /存在对应清单段落时，在 components 中增加 type=shopPickup 的模块/)
    assert.match(instructions, /忽略该段的具体品牌、适用范围等明细/)
    assert.match(instructions, /查询结果已经按 locationId 保存在对应位置记录中/)
    assert.match(instructions, /宿主 UPDATE 函数直接从该位置记录读取资源和标准属性/)
    assert.match(instructions, /required 资源 not_found 时标记 unresolved/)
    assert.match(instructions, /不使用静态候选回退/)
  })

  it('配置清单子 Agent 完成后交还主 Agent', () => {
    const instructions = buildAgentInstructions()

    assert.match(instructions, /配置清单 Agent/)
    assert.match(instructions, new RegExp(CONFIG_CHECKLIST_RETURN_TOOL_NAME))
    assert.match(instructions, /停止写入，把 conflicts 和候选展示给用户等待决策/)
    assert.match(instructions, /依据实际结果做简洁总结/)
  })
})

describe('agent topology', () => {
  it('创建主 Agent、配置清单子 Agent 及双向 handoff', () => {
    const { agent, checklistAgent, agents } = createAgents({
      api: {},
    } as any)

    assert.equal(agent.name, 'Diy Copilot')
    assert.equal(checklistAgent.name, CONFIG_CHECKLIST_AGENT_NAME)
    assert.deepEqual(agents.map(item => item.name), [
      agent.name,
      checklistAgent.name,
    ])
    assert.equal(
      (agent.handoffs[0] as any).toolName,
      CONFIG_CHECKLIST_HANDOFF_TOOL_NAME,
    )
    assert.equal(
      (checklistAgent.handoffs[0] as any).toolName,
      CONFIG_CHECKLIST_RETURN_TOOL_NAME,
    )
    assert.equal(
      checklistAgent.tools.some(item => (item as any).name === 'editor_operator'),
      false,
    )
    assert.equal(
      checklistAgent.tools.some(item => (item as any).name === 'apply_editor_dsl'),
      false,
    )
    assert.equal(
      checklistAgent.tools.some(item => (item as any).name === 'preview_editor_dsl'),
      false,
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
    assert.equal(
      checklistAgent.tools.some(item => (item as any).name === 'query_app_resources'),
      false,
    )
    assert.equal(
      agent.tools.some(item => (item as any).name === 'editor_operator'),
      false,
    )
  })
})
