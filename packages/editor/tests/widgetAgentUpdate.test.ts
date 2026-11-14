import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyWidgetAgentUpdate,
  serializeWidgetAgentNode,
} from '../lib/store/widgetAgent.ts'

describe('serializeWidgetAgentNode', () => {
  it('未设置 nodeIR 时返回编辑器默认节点状态', () => {
    const child = {
      wid: 'child-1',
      type: 'text',
      name: '文本',
      data: { text: '内容' },
      style: { color: 'red' },
      list: [],
      widget: { agent: {} },
    }
    const node = {
      wid: 'root-1',
      type: 'page',
      name: '页面',
      data: {},
      style: {},
      list: [child],
      widget: { agent: {} },
    }

    assert.deepEqual(serializeWidgetAgentNode(node as any), {
      id: 'root-1',
      type: 'page',
      name: '页面',
      data: {},
      style: {},
      children: [{
        id: 'child-1',
        type: 'text',
        name: '文本',
        data: { text: '内容' },
        style: { color: 'red' },
        children: [],
      }],
    })
  })

  it('设置 nodeIR 时以当前 node 实例调用并返回自定义结果', () => {
    const node = {
      wid: 'node-1',
      type: 'card',
      widget: {
        agent: {
          nodeIR(input: unknown) {
            return { kind: 'card-ir', sameNode: input === node }
          },
        },
      },
    }

    assert.deepEqual(serializeWidgetAgentNode(node as any), {
      kind: 'card-ir',
      sameNode: true,
    })
  })
})

describe('widget.agent.update', () => {
  it('passes the component and changes through the DSL execution helper', async () => {
    const calls: unknown[] = []
    const node = {
      type: 'card',
      widget: {
        agent: {
          update(_node: unknown, item: unknown, context: unknown) {
            calls.push({ item, context })
          },
        },
      },
    } as any
    const context = { requestId: 'request-1' }

    await applyWidgetAgentUpdate(node, { title: '更新' }, context)

    assert.deepEqual(calls, [{
      item: {
        widget: 'card',
        items: [],
        changes: { title: '更新' },
      },
      context,
    }])
  })
})
