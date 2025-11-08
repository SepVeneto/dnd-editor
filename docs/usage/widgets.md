# 组件

## 创建

```ts
import { schema, widget } from '@sepveneto/dnde-core'

const input = schema.input({
  label: '标题',
  key: 'title',
})
const richText = schema.custom({
  type: 'richText',
  label: '内容',
  key: 'content',
})

const card = widget.create({
  name: '卡片',
  type: 'card',
  config: {
    fixed: true,
    draggable: false,
    visible: false,
  },
  defaultData: {
    isShow: 1,
  },
  defaultStyle: {
    width: 375,
    height: 100,
  },
  attributes: [
    input,
    richText,
  ]
})
```

这是一个典型的用于编辑器的组件创建。通过`widget.create`可以创建一个基本的组件，向其中传递的对象可以进一步设置组件在组件区中显示的名称和图标，在编辑区中所使用的视图的名称以及选中后在配置区可自定义的内容。

## 全局配置

编辑器默认存在一个根节点，也就是页面本身，可以认为是一个全局组件。一般可以用来配置主题色或者弹窗通知之类的。在这种情况下`widget.create`需要指定`type: 'page'`

```ts
const rootPage = widget.create({
  name: '页面',
  type: 'page',
  // 由于是作为根节点设置，所以不需要它出现在组件区
  meta: { visible: false }
})
```

## 类型定义

::: details 显示类型定义
```ts twoslash
import type {
  ColorPickerInstance,
  DatePickerInstance,
  ElOption,
  ElRadio,
  ElRadioButton,
  FormItemProps,
  FormItemRule,
  ImageInstance,
  InputInstance,
  InputNumberInstance,
  RadioGroupInstance,
  SelectInstance,
  SwitchInstance
} from 'element-plus'
import type { CSSProperties } from 'vue'

interface CWidget {
  /**
   *组件名称
   */
  name: IWidget['_name']
  /**
   * 视图名称
   */
  type: IWidget['_view']
  /**
   * 组件图标
   */
  icon?: IWidget['_icon']
  /**
   * 组件的交互配置
   */
  config?: IWidget['meta']
  /**
   * 是否把组件视为容器处理
   */
  isContainer?: IWidget['container']
  /**
   * 默认样式
   */
  defaultStyle?: IWidget['style']
  /**
   * 默认数据
   */
  defaultData?: Record<string, any>
  /**
   * 支持的配置属性
   */
  attributes?: SchemaItem[]
  /**
   * 支持的样式属性
   */
  stylesheet?: SchemaItem[]
}

interface IWidget {
  _name: string
  _view: string
  _icon?: string
  container?: boolean
  meta?: {
    /**
     * 在编辑区是否允许拖拽
     */
    draggable?: boolean
    /**
     * 在组件区是否可见
     */
    visible?: boolean
    /**
     * 在编辑区的位置是否固定
     *
     * 一般与draggable配合使用，达到类似header之类的效果
     */
    fixed?: boolean
  }
  style?: CSSProperties & WidgetPos
}
export interface WidgetPos {
  x?: number
  y?: number
  width?: number
  height?: number
}

export type Option = InstanceType<typeof ElOption>
export type RadioOption = InstanceType<typeof ElRadio>
export type RadioButtonOption = InstanceType<typeof ElRadioButton>

interface SchemaItemBase {
  label: string
  key: string
  formItem?: Partial<FormItemProps>
  rules?: FormItemRule | FormItemRule[]
}
interface SchemaItemInput extends SchemaItemBase { type: 'input', attrs?: InputInstance['$props'] }
interface SchemaItemSelect extends SchemaItemBase { type: 'select', options?: Option['$props'][], attrs?: SelectInstance['$props'] }
interface SchemaItemNumber extends SchemaItemBase { type: 'number', attrs?: InputNumberInstance['$props'] }
interface SchemaItemSwitch extends SchemaItemBase { type: 'switch', attrs?: SwitchInstance['$props'] }
interface SchemaItemImage extends SchemaItemBase { type: 'image', attrs?: ImageInstance['$props'] }
interface SchemaItemDatetimePicker extends SchemaItemBase { type: 'datetimePicker', attrs?: Partial<DatePickerInstance['$props']> }
interface SchemaItemColorPicker extends SchemaItemBase { type: 'colorPicker', attrs?: ColorPickerInstance['$props'] }
export interface SchemaItemCustom extends SchemaItemBase {
  type: 'custom'
  name: string
  attrs?: Record<string, any>
}
interface SchemaItemStyleNumber extends SchemaItemBase {
  type: 'styleNumber'
}
interface SchemaItemRadio extends SchemaItemBase { type: 'radio', attrs?: RadioGroupInstance['$props'], options?: RadioOption['$props'][] }
interface SchemaItemRadioButton extends SchemaItemBase { type: 'radioButton', attrs?: RadioGroupInstance['$props'], options?: RadioButtonOption['$props'][] }

export type SchemaItem = SchemaItemInput
  | SchemaItemSelect
  | SchemaItemNumber
  | SchemaItemSwitch
  | SchemaItemImage
  | SchemaItemCustom
  | SchemaItemStyleNumber
  | SchemaItemRadio
  | SchemaItemRadioButton
  | SchemaItemDatetimePicker
  | SchemaItemColorPicker
```
:::
