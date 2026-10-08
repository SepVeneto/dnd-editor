import { describe, expect, it } from 'vitest'
import { schema } from '../src'
import { Node, RootNode, Widget } from '../src/class'

function makeWidget(extra: Record<string, any> = {}) {
  return new Widget({ _name: '卡片', _view: 'card', ...extra })
}

function widgetWithRequired() {
  return new Widget({
    _name: '卡片',
    _view: 'card',
    schema: { props: [schema.input({ label: '标题', key: 'title', required: true })] },
  })
}

describe('Node', () => {
  it('未指定 uuid 时自动生成', () => {
    const node = new Node(makeWidget())
    expect(typeof node.wid).toBe('string')
    expect(node.wid).toHaveLength(36)
    expect(node.list).toEqual([])
    expect(node.data).toEqual({})
    expect(node.style).toEqual({})
  })

  it('使用传入的 uuid / props / style', () => {
    const node = new Node(makeWidget(), { uuid: 'u-1', props: { title: 'x' }, style: { color: 'red' } })
    expect(node.wid).toBe('u-1')
    expect(node.data).toEqual({ title: 'x' })
    expect(node.style).toEqual({ color: 'red' })
  })

  it('info 合并 style 与 data', () => {
    const node = new Node(makeWidget(), { props: { title: 'x' }, style: { color: 'red' } })
    expect(node.info).toEqual({ style: { color: 'red' }, title: 'x' })
  })

  it('type / name 来自 widget', () => {
    const node = new Node(makeWidget())
    expect(node.type).toBe('card')
    expect(node.name).toBe('卡片')
  })

  it('name 缺省时为「页面」', () => {
    const node = new Node(new Widget({ _name: undefined as any, _view: 'x' }))
    expect(node.name).toBe('页面')
  })

  it('isContainer / hasList', () => {
    expect(new Node(makeWidget()).isContainer).toBe(false)
    expect(new Node(makeWidget({ container: true })).isContainer).toBe(true)
    const node = new Node(makeWidget())
    expect(node.hasList).toBe(false)
    node.setList([new Node(makeWidget())])
    expect(node.hasList).toBe(true)
  })

  it('visible 取决于 data.isShow', () => {
    expect(new Node(makeWidget()).visible).toBeUndefined()
    expect(new Node(makeWidget(), { props: { isShow: 0 } }).visible).toBe(false)
    expect(new Node(makeWidget(), { props: { isShow: 1 } }).visible).toBe(true)
  })

  it('triggerHover 影响 mouseover', () => {
    const node = new Node(makeWidget())
    expect(node.mouseover).toBe(false)
    node.triggerHover(true)
    expect(node.mouseover).toBe(true)
  })

  it('copy 生成新节点且与源节点互相独立', () => {
    const child = new Node(makeWidget({ _name: '子' }), { uuid: 'c-1', props: { v: 1 } })
    const node = new Node(makeWidget(), { uuid: 'p-1', props: { title: 'x' }, style: { color: 'red' }, list: [child] })
    const copy = node.copy()

    expect(copy.wid).not.toBe(node.wid)
    expect(copy.data).toEqual(node.data)
    expect(copy.style).toEqual(node.style)
    expect(copy.list).toHaveLength(1)
    expect(copy.list[0].wid).not.toBe('c-1')

    copy.data.title = 'changed'
    expect(node.data.title).toBe('x')
  })

  it('parse 输出可序列化结构', () => {
    const node = new Node(makeWidget(), { uuid: 'p-1', props: { title: 'x' }, style: { color: 'red' } })
    expect(node.parse()).toEqual({
      _uuid: 'p-1',
      _name: '卡片',
      _view: 'card',
      data: { title: 'x' },
      style: { color: 'red' },
      list: [],
    })
  })
})

describe('Node.validate', () => {
  it('校验通过时返回 undefined', async () => {
    const node = new Node(widgetWithRequired(), { props: { title: 'ok' } })
    await expect(node.validate()).resolves.toBeUndefined()
  })

  it('校验失败时返回自身 wid', async () => {
    const node = new Node(widgetWithRequired(), { uuid: 'bad', props: {} })
    await expect(node.validate()).resolves.toBe('bad')
  })

  it('only=true 时不校验子节点', async () => {
    const parent = new Node(new Widget({ _name: '容器', _view: 'container', container: true }))
    const child = new Node(widgetWithRequired(), { uuid: 'child', props: {} })
    parent.setList([child])

    await expect(parent.validate(true)).resolves.toBeUndefined()
    await expect(parent.validate()).resolves.toBe('child')
  })
})

describe('RootNode', () => {
  it('忽略传入的 list', () => {
    const root = new RootNode(makeWidget(), { props: { a: 1 }, list: [new Node(makeWidget())] })
    expect(root.list).toEqual([])
    expect(root.data).toEqual({ a: 1 })
  })
})
