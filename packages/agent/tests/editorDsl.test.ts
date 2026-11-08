/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RunContext } from '@openai/agents'
import {
  APPLY_EDITOR_DSL_TOOL_NAME,
  createEditorDslTools,
  GET_WIDGETS_TOOL_NAME,
  VALIDATE_EDITOR_DSL_TOOL_NAME,
} from '../src/editorDsl.ts'

function validDsl() {
  return {
    dslVersion: '1.1' as const,
    baseRevision: 3,
    scope: {
      mode: 'any' as const,
      targets: [],
    },
    operations: [{
      op: 'add' as const,
      key: 'banner',
      widget: 'image',
      props: { title: 'Hello' },
    }],
  }
}

describe('editor DSL tools', () => {
  it('向宿主子 Agent 暴露完整 DSL 校验和应用入口', () => {
    const tools = createEditorDslTools({})

    assert.deepEqual(tools.map(item => item.name), [
      'get_current_editor',
      'get_widgets',
      'validate_editor_dsl',
      'apply_editor_dsl',
      'undo_editor_dsl',
    ])
  })

  it('组件目录排除 page 和组件实现字段', async () => {
    const tools = createEditorDslTools({
      editor: {
        getCurrentEditor: () => ({ revision: 3 }),
        getWidgets: () => ({
          catalogVersion: '1.0',
          widgets: [
            {
              type: 'page',
              name: '页面',
              defaultData: { title: '首页' },
              defaultStyle: { height: 667 },
              attributes: [],
            },
            {
              type: 'card',
              name: '卡片',
              description: '卡片组件',
              defaultData: { title: '默认标题' },
              defaultStyle: { width: 375 },
              attributes: [{ key: 'title' }],
              fields: [{ key: 'title' }],
              customTypes: [{ type: 'card', capabilities: [] }],
              staticOptions: [{ id: 'one', name: '选项一', aliases: [], value: 1, types: ['enum'] }],
            },
          ],
        }),
        validateDsl: () => ({ ok: true, issues: [] }),
        applyDsl: () => ({ ok: true }),
      },
    })
    const widgetsTool = tools.find(item => item.name === GET_WIDGETS_TOOL_NAME)!

    const result = await widgetsTool.invoke(
      new RunContext({}),
      JSON.stringify({}),
    )

    assert.deepEqual(result, {
      catalogVersion: '1.0',
      widgets: [{
        type: 'card',
        name: '卡片',
        description: '卡片组件',
      }],
    })
  })

  it('校验工具透传当前 Run Context 且不修改文档', async () => {
    let seenContext: unknown
    let applied = false
    const tools = createEditorDslTools({
      editor: {
        getCurrentEditor: () => ({ revision: 3 }),
        getWidgets: () => [],
        validateDsl(dsl, context) {
          seenContext = context
          return { ok: true, issues: [], normalized: dsl }
        },
        applyDsl() {
          applied = true
          return { ok: true }
        },
      },
    })
    const validateTool = tools.find(
      item => item.name === VALIDATE_EDITOR_DSL_TOOL_NAME,
    )!
    const runContext = new RunContext({ businessId: 7 })

    const result = await validateTool.invoke(
      runContext,
      JSON.stringify({ dsl: validDsl() }),
    )

    assert.deepEqual(result, {
      ok: true,
      issues: [],
      normalized: validDsl(),
    })
    assert.deepEqual(seenContext, { businessId: 7 })
    assert.equal(applied, false)
  })

  it('应用前先校验，校验失败时不写入', async () => {
    let applied = false
    const tools = createEditorDslTools({
      editor: {
        getCurrentEditor: () => ({ revision: 3 }),
        getWidgets: () => [],
        validateDsl() {
          return {
            ok: false,
            issues: [{
              code: 'unknown_widget',
              path: 'operations[0].widget',
              message: '组件不存在',
            }],
          }
        },
        applyDsl() {
          applied = true
          return { ok: true }
        },
      },
    })
    const applyTool = tools.find(
      item => item.name === APPLY_EDITOR_DSL_TOOL_NAME,
    )!

    const result = await applyTool.invoke(
      new RunContext({}),
      JSON.stringify({ dsl: validDsl() }),
    )

    assert.equal((result as any).ok, false)
    assert.equal(applied, false)
  })

  it('校验成功后以完整 DSL 调用宿主 applyDsl', async () => {
    let received: unknown
    const tools = createEditorDslTools({
      editor: {
        getCurrentEditor: () => ({ revision: 3 }),
        getWidgets: () => [],
        validateDsl: dsl => ({ ok: true, issues: [], normalized: dsl }),
        applyDsl(dsl) {
          received = dsl
          return { ok: true, revision: 4 }
        },
      },
    })
    const applyTool = tools.find(
      item => item.name === APPLY_EDITOR_DSL_TOOL_NAME,
    )!

    const result = await applyTool.invoke(
      new RunContext({}),
      JSON.stringify({ dsl: validDsl() }),
    )

    assert.deepEqual(received, validDsl())
    assert.deepEqual(result, { ok: true, revision: 4 })
  })
})
