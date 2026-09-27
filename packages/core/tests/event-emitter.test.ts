import { describe, expect, it, vi } from 'vitest'
import { createCopy, createDelete, EventEmitter } from '../src'
import { Node, Widget } from '../src/class'
import { likeArray } from '../src/utils'

describe('EventEmitter', () => {
  it('emit 先调用 notify，再触发订阅者', () => {
    const notify = vi.fn()
    const bus = new EventEmitter(notify)
    const cb = vi.fn()

    bus.on('foo', cb)
    bus.emit('foo', 1, 2)

    expect(notify).toHaveBeenCalledWith('foo', 1, 2)
    expect(cb).toHaveBeenCalledWith(1, 2)
  })

  it('没有订阅者时仍然调用 notify', () => {
    const notify = vi.fn()
    new EventEmitter(notify).emit('bar')
    expect(notify).toHaveBeenCalledWith('bar')
  })

  it('off 移除订阅者', () => {
    const bus = new EventEmitter(vi.fn())
    const cb = vi.fn()
    bus.on('foo', cb)
    bus.off('foo', cb)
    bus.emit('foo')
    expect(cb).not.toHaveBeenCalled()
  })

  it('clear 清空订阅但保留 notify', () => {
    const notify = vi.fn()
    const bus = new EventEmitter(notify)
    const cb = vi.fn()
    bus.on('foo', cb)
    bus.clear()
    bus.emit('foo')
    expect(cb).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledWith('foo')
  })

  it('同一事件支持多个订阅者', () => {
    const bus = new EventEmitter(vi.fn())
    const a = vi.fn()
    const b = vi.fn()
    bus.on('foo', a)
    bus.on('foo', b)
    bus.emit('foo')
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('likeArray', () => {
  it('非数组包成单元素数组', () => {
    expect(likeArray(1)).toEqual([1])
  })

  it('数组原样返回', () => {
    const arr = [1, 2]
    expect(likeArray(arr)).toBe(arr)
  })
})

describe('内置操作', () => {
  it('createCopy 复制节点并挂到原父级', () => {
    const ctx = { addNode: vi.fn(), delNode: vi.fn() }
    const parent = new Node(new Widget({ _name: 'p', _view: 'p' }))
    const node = new Node(new Widget({ _name: 'n', _view: 'n' }))
    node.parent = parent

    const action = createCopy(ctx)
    expect(action.name).toBe('copy')
    action.action(node)

    expect(ctx.addNode).toHaveBeenCalledTimes(1)
    const [copied, parentArg, manual] = ctx.addNode.mock.calls[0]
    expect(copied).toBeInstanceOf(Node)
    expect(copied.wid).not.toBe(node.wid)
    expect(parentArg).toBe(parent)
    expect(manual).toBe(true)
  })

  it('createDelete 按 wid 删除节点', () => {
    const ctx = { addNode: vi.fn(), delNode: vi.fn() }
    const node = new Node(new Widget({ _name: 'n', _view: 'n' }))
    const action = createDelete(ctx)
    expect(action.name).toBe('delete')
    action.action(node)
    expect(ctx.delNode).toHaveBeenCalledWith(node.wid)
  })
})
