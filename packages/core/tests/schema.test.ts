import { describe, expect, it } from 'vitest'
import { isBox, schema, widget, widgetType } from '../src'

describe('schema', () => {
  it('为内置类型生成对应 type 的配置项', () => {
    expect(schema.input({ label: '标题', key: 'title' })).toMatchObject({ type: 'input', label: '标题', key: 'title' })
    expect(schema.number({ label: '数量', key: 'num' })).toMatchObject({ type: 'number' })
    expect(schema.checkbox({ label: '可见', key: 'isShow' })).toMatchObject({ type: 'checkbox' })
    expect(schema.switch({ label: '开关', key: 'open' })).toMatchObject({ type: 'switch' })
    expect(schema.time({ label: '时间', key: 'time' })).toMatchObject({ type: 'datetimePicker' })
    expect(schema.color({ label: '颜色', key: 'color' })).toMatchObject({ type: 'colorPicker' })
    expect(schema.styleNumber({ label: '宽度', key: 'width' })).toMatchObject({ type: 'styleNumber' })
  })

  it('select / radio / radioButton 会带上 options 与 link', () => {
    const options = [{ label: 'A', value: 'a' }]
    const link = { a: [schema.input({ label: '子项', key: 'child' })] }
    expect(schema.select({ label: '选择', key: 'sel', options, link })).toMatchObject({ type: 'select', options, link })
    expect(schema.radio({ label: '单选', key: 'r', options })).toMatchObject({ type: 'radio', options })
    expect(schema.radioButton({ label: '按钮', key: 'rb', options })).toMatchObject({ type: 'radioButton', options })
  })

  it('默认不带校验规则', () => {
    expect(schema.input({ label: '标题', key: 'title' }).rules).toEqual([])
  })

  it('required 为 true 时生成默认必填提示', () => {
    expect(schema.input({ label: '标题', key: 'title', required: true }).rules).toEqual([
      { required: true, message: '请填写标题' },
    ])
  })

  it('required 为字符串时作为提示信息', () => {
    expect(schema.input({ label: '标题', key: 'title', required: '必须填写标题' }).rules).toEqual([
      { required: true, message: '必须填写标题' },
    ])
  })

  it('透传自定义 rules', () => {
    const rule = { min: 1, message: '至少 1 个字符' }
    expect(schema.input({ label: '标题', key: 'title', rules: [rule] }).rules).toEqual([rule])
  })

  it('custom 类型会把 type 映射到 name', () => {
    expect(schema.custom({ type: 'richText', label: '内容', key: 'content' })).toMatchObject({
      type: 'custom',
      name: 'richText',
      label: '内容',
      key: 'content',
    })
  })

  it('topbar 是 radio 的预设，并带 _role 标记', () => {
    expect(schema.topbar({ label: '顶部导航栏', key: 'topbar' })).toMatchObject({
      type: 'radio',
      _role: 'topbar',
    })
  })
})

describe('widget', () => {
  it('create 把入参映射到 IWidget 结构', () => {
    const attributes = [schema.input({ label: '标题', key: 'title' })]
    const stylesheet = [schema.color({ label: '背景', key: 'bg' })]
    const created = widget.create({
      name: '卡片',
      type: 'card',
      icon: 'card-icon',
      config: { draggable: false, visible: false },
      isContainer: true,
      defaultStyle: { width: 375 },
      defaultData: { isShow: 1 },
      attributes,
      stylesheet,
    })

    expect(created).toMatchObject({
      _name: '卡片',
      _view: 'card',
      _icon: 'card-icon',
      container: true,
      meta: { draggable: false, visible: false },
      style: { width: 375 },
      data: { isShow: 1 },
    })
    expect(created.schema?.props).toEqual(attributes)
    expect(created.schema?.style).toEqual(stylesheet)
  })

  it('root 固定为 page 且不出现在组件区', () => {
    expect(widget.root({ name: '页面' })).toMatchObject({
      _name: '页面',
      _view: 'page',
      meta: { visible: false },
    })
  })

  it('columnContainer 是容器类型', () => {
    expect(widget.columnContainer({})).toMatchObject({ _view: 'containerGrid', container: true })
  })

  it('group 使用 widgetType.GROUP 标记', () => {
    const group = widget.group('基础组件', [])
    expect(group).toMatchObject({ name: '基础组件', type: widgetType.GROUP })
    expect(widgetType.GROUP).toBe(1)
  })
})

describe('isBox', () => {
  it('识别 box 类型', () => {
    expect(isBox({ type: 'box' })).toBe(true)
    expect(isBox(schema.input({ label: '标题', key: 'title' }))).toBe(false)
  })
})
