/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildAgentInstructions } from '../src/agentInstructions.ts'

describe('agent instructions', () => {
  it('参考图先规划布局和组件内容，再查询业务数据并填充', () => {
    const instructions = buildAgentInstructions()

    const layoutIndex = instructions.indexOf('先解析图片中的整体布局')
    const contentIndex = instructions.indexOf('先为每个组件形成内容填充计划')
    const queryIndex = instructions.indexOf('最后才调用业务查询工具获取真实数据')

    assert.ok(layoutIndex >= 0)
    assert.ok(contentIndex > layoutIndex)
    assert.ok(queryIndex > contentIndex)
    assert.match(instructions, /组件功能描述和用户清单中的配置需求/)
    assert.match(instructions, /通过 editor_operator 按计划创建和填充页面/)
  })
})
