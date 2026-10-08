import type { Node } from '@sepveneto/dnde-core/class'
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  findDuplicatedWid,
  handleNodeAdd,
  handleNodeInput,
  isFixedBoundary,
  resolveDuplicateRemovalIndex,
} from '../lib/composables/dragCore.ts'

/** 只保留拖拽逻辑用到的字段（widget.isFixed 是 Widget 归一化后的值） */
function node(wid: string, fixed?: boolean | 'header' | 'footer'): Node {
  return { wid, widget: { isFixed: fixed } } as unknown as Node
}

function wids(list: Node[]) {
  return list.map(item => item.wid)
}

/** 记录 host 回调，便于断言被撤销时还原到了哪里 */
function makeHost() {
  const restored: Array<{ containerId: string, index: number, node: Node }> = []
  const added: Array<{ node: Node, parent: Node }> = []
  return {
    restored,
    added,
    host: {
      restoreToContainer: (containerId: string, index: number, n: Node) => {
        restored.push({ containerId, index, node: n })
      },
      addNode: (n: Node, parent: Node) => {
        added.push({ node: n, parent })
      },
    },
  }
}

/** 同一列表内的放入事件（from 与 to 是同一个元素） */
function sameListEvent(newIndex: number, newDraggableIndex = newIndex) {
  const el: { dataset: { id?: string } } = { dataset: {} }
  return { newIndex, newDraggableIndex, oldIndex: 0, from: el, to: el }
}

/** 跨容器的放入事件 */
function crossListEvent(newIndex: number, oldIndex: number, fromId?: string, toId = 'new') {
  return {
    newIndex,
    newDraggableIndex: newIndex,
    oldIndex,
    // fromId 为 undefined 表示来自组件栏（源元素没有 data-id）
    from: { dataset: fromId === undefined ? {} : { id: fromId } },
    to: { dataset: { id: toId } },
  }
}

describe('findDuplicatedWid', () => {
  it('没有重复时返回 undefined', () => {
    assert.equal(findDuplicatedWid([node('a'), node('b')]), undefined)
  })

  it('返回第一处重复的 wid', () => {
    assert.equal(findDuplicatedWid([node('a'), node('b'), node('b'), node('a')]), 'b')
  })
})

describe('isFixedBoundary', () => {
  it('下一个节点是 header 时视为边界', () => {
    assert.equal(isFixedBoundary([node('a'), node('h', 'header')], 0), true)
  })

  it('上一个节点是 footer 时视为边界', () => {
    assert.equal(isFixedBoundary([node('f', 'footer'), node('a')], 1), true)
  })

  it('header 之前、footer 之后不受限制', () => {
    assert.equal(isFixedBoundary([node('h', 'header'), node('a')], 1), false)
    assert.equal(isFixedBoundary([node('a'), node('f', 'footer')], 0), false)
  })

  it('相邻没有 fixed 时不视为边界', () => {
    assert.equal(isFixedBoundary([node('a'), node('b'), node('c')], 1), false)
  })

  it('只识别归一化后的值：未归一化的 true 不视为边界（需先经 Widget.isFixed）', () => {
    assert.equal(isFixedBoundary([node('a'), node('raw', true)], 0), false)
  })
})

describe('resolveDuplicateRemovalIndex', () => {
  it('旧元素在上方（下移）时删除原下标', () => {
    // b 被拖到 a 之前，重复的是 a
    assert.equal(
      resolveDuplicateRemovalIndex([node('a'), node('b')], [node('a'), node('b'), node('a')], 'a', 0),
      0,
    )
  })

  it('旧元素在下方（上移）时删除原下标 +1', () => {
    // a 被拖到 b 之后，重复的是 b
    assert.equal(
      resolveDuplicateRemovalIndex([node('a'), node('b')], [node('b'), node('a'), node('b')], 'b', 1),
      2,
    )
  })

  it('重复项紧邻 footer 时保留', () => {
    assert.equal(
      resolveDuplicateRemovalIndex(
        [node('a'), node('b')],
        [node('a'), node('f', 'footer'), node('a'), node('b')],
        'a',
        0,
      ),
      -1,
    )
  })

  it('重复项紧邻 header 时保留', () => {
    assert.equal(
      resolveDuplicateRemovalIndex(
        [node('a'), node('b')],
        [node('b'), node('a'), node('h', 'header'), node('a')],
        'a',
        0,
      ),
      -1,
    )
  })
})

describe('handleNodeAdd（fixed 拦截）', () => {
  it('落点在 header 之前时撤销插入，且不登记节点', () => {
    const a = node('a')
    const target = { list: [a, node('h', 'header')], parent: node('root'), setList: () => {} }
    const { host, added, restored } = makeHost()

    handleNodeAdd(target, sameListEvent(0), host)

    assert.deepEqual(wids(target.list), ['h'])
    assert.equal(added.length, 0)
    assert.equal(restored.length, 0)
  })

  it('落点在 footer 之后时撤销插入', () => {
    const a = node('a')
    const target = { list: [node('f', 'footer'), a], parent: node('root'), setList: () => {} }
    const { host, added } = makeHost()

    handleNodeAdd(target, sameListEvent(1), host)

    assert.deepEqual(wids(target.list), ['f'])
    assert.equal(added.length, 0)
  })

  it('跨容器被撤销时，按原下标还原回原容器', () => {
    const a = node('a')
    const target = { list: [a, node('h', 'header')], parent: node('root'), setList: () => {} }
    const { host, restored } = makeHost()

    handleNodeAdd(target, crossListEvent(0, 1, 'old', 'new'), host)

    assert.deepEqual(wids(target.list), ['h'])
    assert.equal(restored.length, 1)
    assert.equal(restored[0].containerId, 'old')
    assert.equal(restored[0].index, 1)
    assert.equal(restored[0].node, a)
  })

  it('同容器被撤销时不触发还原', () => {
    const target = { list: [node('a'), node('h', 'header')], parent: node('root'), setList: () => {} }
    const { host, restored } = makeHost()

    handleNodeAdd(target, sameListEvent(0), host)

    assert.equal(restored.length, 0)
  })

  it('来自组件栏（源元素没有 data-id）时不还原', () => {
    const target = { list: [node('a'), node('h', 'header')], parent: node('root'), setList: () => {} }
    const { host, restored } = makeHost()

    handleNodeAdd(target, crossListEvent(0, 0, undefined, 'new'), host)

    assert.deepEqual(wids(target.list), ['h'])
    assert.equal(restored.length, 0)
  })

  it('落点不紧邻 fixed 时，把节点登记到目标父节点下', () => {
    const a = node('a')
    const b = node('b')
    const parent = node('root')
    const target = { list: [a, b], parent, setList: () => {} }
    const { host, added, restored } = makeHost()

    handleNodeAdd(target, sameListEvent(1), host)

    assert.deepEqual(wids(target.list), ['a', 'b'])
    assert.equal(restored.length, 0)
    assert.equal(added.length, 1)
    assert.equal(added[0].node, b)
    assert.equal(added[0].parent, parent)
  })
})

describe('handleNodeInput（fixed 边界保留）', () => {
  it('长度未增加（同级重排）时直接替换', () => {
    const calls: Node[][] = []
    const target = { list: [node('a'), node('b')], parent: node('root'), setList: (l: Node[]) => calls.push(l) }
    const val = [node('b'), node('a')]

    handleNodeInput(target, val, fn => fn())

    assert.deepEqual(calls, [val])
  })

  it('长度增加但没有重复时直接替换', () => {
    const calls: Node[][] = []
    const target = { list: [node('a')], parent: node('root'), setList: (l: Node[]) => calls.push(l) }
    const val = [node('a'), node('b')]

    handleNodeInput(target, val, fn => fn())

    assert.deepEqual(calls, [val])
  })

  it('长度增加且有重复时，延迟写入清理后的列表', () => {
    const calls: Node[][] = []
    const deferred: Array<() => void> = []
    const target = { list: [node('a'), node('b')], parent: node('root'), setList: (l: Node[]) => calls.push(l) }
    const val = [node('a'), node('b'), node('a')]

    handleNodeInput(target, val, fn => deferred.push(fn))

    assert.equal(calls.length, 0)
    assert.equal(deferred.length, 1)
    deferred[0]()
    assert.deepEqual(wids(calls[0]), ['b', 'a'])
  })

  it('重复项紧邻 footer 时保留，不做删除', () => {
    const calls: Node[][] = []
    const deferred: Array<() => void> = []
    const target = { list: [node('a'), node('b')], parent: node('root'), setList: (l: Node[]) => calls.push(l) }
    const val = [node('a'), node('f', 'footer'), node('a'), node('b')]

    handleNodeInput(target, val, fn => deferred.push(fn))
    deferred[0]()

    assert.deepEqual(wids(calls[0]), ['a', 'f', 'a', 'b'])
  })

  it('重复的 wid 不在原列表中时直接替换', () => {
    const calls: Node[][] = []
    const target = { list: [node('x')], parent: node('root'), setList: (l: Node[]) => calls.push(l) }
    const val = [node('a'), node('a')]

    handleNodeInput(target, val, fn => fn())

    assert.deepEqual(calls, [val])
  })
})
