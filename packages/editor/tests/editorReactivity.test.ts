import type { Node } from '@sepveneto/dnde-core/class'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effect } from 'vue'
import { toReactiveNode } from '../lib/store/reactiveNode.ts'

describe('addNode response', () => {
  it('returns a reactive node so mutating node.data updates render dependencies', () => {
    const node = toReactiveNode({
      data: { data: { list: [] } },
    } as Node)
    const observed: number[] = []
    const stop = effect(() => {
      observed.push(node.data.data.list.length)
    }, { flush: 'sync' })

    node.data.data.list = [{ name: '入口 A' }, { name: '入口 B' }]
    stop()

    assert.equal(observed[0], 0)
    assert.equal(observed.at(-1), 2)
    assert.ok(observed.length > 1)
  })
})
