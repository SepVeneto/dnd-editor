/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  completeEditorOperation,
  createEditorAgentContext,
  editorOperationSucceeded,
  prepareEditorOperation,
} from '../src/editorContext.ts'

describe('editor context', () => {
  it('每次 Run 创建独立 Context，并透传宿主初始数据', () => {
    const first = createEditorAgentContext({ businessId: 'a' })
    const second = createEditorAgentContext({ businessId: 'b' })

    assert.equal(first.businessId, 'a')
    assert.equal(second.businessId, 'b')
    assert.notEqual(first, second)
  })

  it('add 时不注入 Context 数据，并移除模型生成的 items', () => {
    const context = createEditorAgentContext()
    context.businessData = [{ id: 1, name: '大米' }]

    const prepared = prepareEditorOperation({
      action: 'add',
      widget: 'product',
      target: 'root',
      items: [{ id: 999, name: '伪造商品' }],
      changes: { list: [{ name: '模型伪造内容' }] },
      style: { width: 375 },
    }, context)

    assert.equal(prepared.operation.items, undefined)
    assert.deepEqual(context.businessData, [{ id: 1, name: '大米' }])
    assert.equal(prepared.operation.target, undefined)
    assert.equal(prepared.operation.changes, undefined)
    assert.deepEqual(prepared.operation.style, { width: 375 })
  })

  it('add 时移除 target，布局操作不允许嵌套', () => {
    const context = createEditorAgentContext()
    const prepared = prepareEditorOperation({
      action: 'add',
      widget: 'product',
      target: 'container-1',
    }, context)

    assert.equal(prepared.operation.target, undefined)
  })

  it('edit 时丢弃模型 changes，但保留 style', () => {
    const prepared = prepareEditorOperation({
      action: 'edit',
      target: 'node-1',
      changes: { list: [{ name: '模型伪造内容' }] },
      style: { marginTop: 12 },
    }, createEditorAgentContext())

    assert.equal(prepared.operation.changes, undefined)
    assert.deepEqual(prepared.operation.style, { marginTop: 12 })
  })

  it('add 允许没有待注入数据，但丢弃模型 changes', () => {
    const prepared = prepareEditorOperation({
      action: 'add',
      widget: 'topEntry',
      changes: { data: { list: [] } },
    }, createEditorAgentContext())

    assert.equal(prepared.error, undefined)
    assert.equal(prepared.operation.changes, undefined)
    assert.equal(prepared.operation.items, undefined)
  })

  it('没有业务工具准备的数据时仍允许 add', () => {
    const prepared = prepareEditorOperation({
      action: 'add',
      widget: 'product',
    }, createEditorAgentContext())

    assert.equal(prepared.error, undefined)
    assert.equal(prepared.operation.widget, 'product')
    assert.equal(prepared.operation.items, undefined)
  })

  it('add 不消费 Context 中的业务数据', () => {
    const context = createEditorAgentContext()
    context.businessData = [{ id: 1 }]
    const prepared = prepareEditorOperation({
      action: 'add',
      widget: 'product',
    }, context)

    completeEditorOperation(context, prepared, { ok: false, error: '节点不存在' })
    assert.deepEqual(context.businessData, [{ id: 1 }])

    completeEditorOperation(context, prepared, { ok: true, id: 'node-1' })
    assert.deepEqual(context.businessData, [{ id: 1 }])
  })

  it('只有显式 ok:false 才视为失败', () => {
    assert.equal(editorOperationSucceeded(undefined), true)
    assert.equal(editorOperationSucceeded({ node: { id: 'node-1' } }), true)
    assert.equal(editorOperationSucceeded({ ok: false }), false)
    assert.equal(editorOperationSucceeded({ error: '写入失败' }), false)
  })
})
