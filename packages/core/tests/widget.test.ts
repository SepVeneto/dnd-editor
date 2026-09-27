import { describe, expect, it } from 'vitest'
import { schema, widget } from '../src'
import { Container, Widget } from '../src/class'

const source = widget.create({
  name: '卡片',
  type: 'card',
  icon: 'card',
  config: { draggable: false, visible: false, fixed: true },
  isContainer: true,
  defaultStyle: { width: 375 },
  defaultData: { isShow: 1 },
  attributes: [schema.input({ label: '标题', key: 'title' })],
  stylesheet: [schema.color({ label: '背景', key: 'bg' })],
})

describe('Widget', () => {
  it('读取基本信息', () => {
    const w = new Widget(source)
    expect(w.name).toBe('卡片')
    expect(w.view).toBe('card')
    expect(w.icon).toBe('card')
    expect(w.container).toBe(true)
    expect(w.props).toHaveLength(1)
    expect(w.style).toHaveLength(1)
    expect(w.defaultStyle).toEqual({ width: 375 })
    expect(w.defaultData).toEqual({ isShow: 1 })
  })

  it('对传入数据做深拷贝，后续修改互不影响', () => {
    const mutable: any = JSON.parse(JSON.stringify(source))
    const w = new Widget(mutable)
    mutable._name = 'changed'
    mutable.schema.props.push('x')
    expect(w.name).toBe('卡片')
    expect(w.props).toHaveLength(1)
  })

  it('clone 产生独立副本', () => {
    const w = new Widget(source)
    const c = w.clone()
    expect(c).not.toBe(w)
    expect(c._data).not.toBe(w._data)
    expect(c._data).toEqual(w._data)
    c._data._name = 'changed'
    expect(w.name).toBe('卡片')
  })

  it('draggable / visible 默认值', () => {
    expect(new Widget({ _name: 'a', _view: 'a' }).draggable).toBe(true)
    expect(new Widget({ _name: 'a', _view: 'a' }).visible).toBe(true)
    expect(new Widget(source).draggable).toBe(false)
    expect(new Widget(source).visible).toBe(false)
  })

  it('isFixed 把 true 归一化为 header', () => {
    expect(new Widget({ _name: 'a', _view: 'a' }).isFixed).toBeUndefined()
    expect(new Widget({ _name: 'a', _view: 'a', meta: { fixed: true } }).isFixed).toBe('header')
    expect(new Widget({ _name: 'a', _view: 'a', meta: { fixed: 'footer' } }).isFixed).toBe('footer')
  })

  it('validatorProps / validatorStyle 依据 rules 构建', async () => {
    const w = new Widget({
      _name: 'a',
      _view: 'a',
      schema: { props: [schema.input({ label: '标题', key: 'title', required: true })], style: [] },
    })
    await expect(w.validatorProps.validate({ title: 'x' })).resolves.toBeTruthy()
    await expect(w.validatorProps.validate({})).rejects.toBeTruthy()
    await expect(w.validatorStyle.validate({})).resolves.toBeTruthy()
  })

  it('没有 schema 时 props / style 为空数组', () => {
    const w = new Widget({ _name: 'a', _view: 'a' })
    expect(w.props).toEqual([])
    expect(w.style).toEqual([])
  })
})

describe('Container', () => {
  it('构造时把 view 覆盖为 container', () => {
    const container = new Container({ _name: '容器', _view: 'whatever' })
    expect(container).toBeInstanceOf(Widget)
    // 注意：Container 类覆盖为 'container'，而 widget.columnContainer() 生成的是 'containerGrid'
    expect(container.view).toBe('container')
  })
})
