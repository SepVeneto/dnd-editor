/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAgentInstructions } from '../src/agentInstructions.ts'

describe('agent instructions', () => {
  it('参考图先规划布局和组件内容，再查询业务数据并填充', () => {
    const instructions = buildAgentInstructions()

    const layoutIndex = instructions.indexOf('解析用户需求和参考附件，明确页面结构')
    const contentIndex = instructions.indexOf('为整页建立组件与内容填充计划')
    const queryIndex = instructions.indexOf('才允许调用业务查询工具获取真实数据')

    assert.ok(layoutIndex >= 0)
    assert.ok(contentIndex > layoutIndex)
    assert.ok(queryIndex > contentIndex)
    assert.match(instructions, /结合组件功能描述和用户需求/)
    assert.match(instructions, /按照规划调用 editor_operator/)
  })

  it('参考附件只填充静态编码值，接口动态内容只能来自需求清单和业务工具', () => {
    const instructions = buildAgentInstructions()

    assert.match(instructions, /参考附件可以用于分析页面布局和视觉结构/)
    assert.match(instructions, /不得从附件提取或推断接口动态数据/)
    assert.match(instructions, /模型不参与数据选择、直填或拼装，只负责根据意图调用宿主工具/)
    assert.match(instructions, /模型只能将路由意图关键词传给 query_internal_routes/)
    assert.match(instructions, /由宿主完成匹配、写入 context\.internalRoutes 并准备 pendingItems/)
    assert.match(instructions, /模型不得改写、推断或自行生成路由及其它填充数据/)
    assert.match(instructions, /只能依据用户当前请求中的明确指定，并通过宿主业务工具获取或准备/)
    assert.match(instructions, /附件中出现相关信息不代表用户已指定或授权使用/)
    assert.match(instructions, /除宿主工具已准备并写入 Context 的静态内容外，所有页面填充值必须来自用户当前请求明确提供的需求清单或宿主业务工具返回/)
    assert.match(instructions, /缺少必要内容时必须询问用户，不得使用参考内容作为占位或回退/)
    assert.match(instructions, /数据准备边界不影响编辑器 DSL 工具的正常调用/)
    assert.match(instructions, /调用 get_current_editor 读取页面、调用 get_widgets 查询组件、调用 editor_operator 执行添加、编辑、删除和移动/)
    assert.match(instructions, /意图工具和业务工具只负责准备数据，不能替代编辑器 DSL 操作/)
    assert.match(instructions, /editor_operator 参数中禁止生成、修改或伪造 items，也禁止提交 changes/)
    assert.match(instructions, /名称、跳转类型、分类等即使属于纯静态配置，也不得通过 changes 填充/)
    assert.match(instructions, /静态配置白名单只用于判断当前任务是否需要参考附件/)
    assert.match(instructions, /不得作为填充值来源/)
    assert.match(instructions, /不得伪造接口结果或自行编造数据/)
  })
})
