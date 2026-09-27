---
title: 数据
---

# 数据

组件中的数据都是通过`schema`来定义的，其中`attributes`用来定义组件的属性，`stylesheet`用来定义组件的样式。

## 数据校验

支持`required`快速设置必填校验，同时也支持通过`rules`进行自定义校验。关于`rules`的用法，可以参见[element-plus](https://element-plus.org/zh-CN/component/form#%E8%A1%A8%E5%8D%95%E9%AA%8C%E8%AF%81)

## 示例

```ts
import { schema } from '@sepveneto/dnde-core'

const input = schema.input({
  label: '标题',
  key: 'title',
  formItem: { labelWidth: '80px' },
  required: true,
})
```

## 内置类型

| 类型 | 描述 |
| --- | --- |
| schema.input | 输入框 |
| schema.number | 数字输入框 |
| schema.checkbox | 复选框 |
| schema.select | 选择框，备选项通过`options`设置 |
| schema.radio | 单选框，备选项通过`options`设置 |
| schema.radioButton | 单选按钮，备选项通过`options`设置 |
| schema.switch | 开关 |
| schema.time | 时间选择器 |
| schema.color | 颜色选择器 |
| schema.styleNumber | 样式数字输入框，可切换「自适应 / 自定义」 |
| schema.custom | 自定义类型，需要生产者提供对应的配置组件 |
| schema.topbar | 标记该项为顶部导航栏开关，供页面根节点使用 |

## 自定义类型

当内置类型无法满足需求时，可以通过`schema.custom`自定义类型。它会按 `${type}.config.vue` 在生产者中查找并加载配置组件：

```ts
const richText = schema.custom({
  type: 'richText',
  label: '内容',
  key: 'content',
})
```

## 联动配置

`select`、`radio`、`radioButton`支持通过`link`根据当前值动态追加配置项：

```ts
const type = schema.select({
  label: '类型',
  key: 'type',
  options: [{ label: '图片', value: 'image' }],
  link: {
    image: [
      schema.input({ label: '图片地址', key: 'imageUrl' }),
    ],
  },
})
```

## 类型定义

``` ts twoslash
import type {
  CheckboxProps,
  ColorPickerProps,
  DatePickerProps,
  FormItemProps,
  FormItemRule,
  InputNumberProps,
  InputProps,
  RadioGroupProps,
  SelectProps,
  SwitchProps,
} from 'element-plus'
import type { Option, RadioButtonOption, RadioOption } from '@sepveneto/dnde-core/class'

/** 通过 schema.* 创建配置项时的入参 */
interface BaseConfig {
  /**
   * 标签文本
   */
  label: string
  /**
   * 数据键名，支持 `${key}.${key}` 形式的嵌套路径
   */
  key: string
  /**
   * 对于这个属性的提示信息
   */
  tips?: string
  /**
   * 表单域的属性
   */
  formItem?: Partial<FormItemProps>
  /**
   * 是否必填，可以是一个字符串（作为错误提示）
   */
  required?: boolean | string
  /**
   * 具体的表单校验规则
   */
  rules?: FormItemRule | FormItemRule[]
}

interface SchemaItemBase {
  label: string
  key: string
  formItem?: Partial<FormItemProps>
  rules?: FormItemRule | FormItemRule[]
}
interface SchemaItemInput extends SchemaItemBase { type: 'input', attrs?: InputProps }
interface SchemaItemNumber extends SchemaItemBase { type: 'number', attrs?: InputNumberProps }
interface SchemaItemCheckbox extends SchemaItemBase { type: 'checkbox', attrs?: CheckboxProps }
interface SchemaItemSwitch extends SchemaItemBase { type: 'switch', attrs?: SwitchProps }
interface SchemaItemDatetimePicker extends SchemaItemBase { type: 'datetimePicker', attrs?: DatePickerProps }
interface SchemaItemColorPicker extends SchemaItemBase { type: 'colorPicker', attrs?: ColorPickerProps }
interface SchemaItemStyleNumber extends SchemaItemBase { type: 'styleNumber' }
interface SchemaItemSelect extends SchemaItemBase {
  type: 'select'
  options?: Option[]
  attrs?: SelectProps
  link?: Record<string | number, SchemaItem[]>
}
interface SchemaItemRadio extends SchemaItemBase {
  type: 'radio'
  options?: RadioOption[]
  attrs?: RadioGroupProps
  link?: Record<string | number, SchemaItem[]>
}
interface SchemaItemRadioButton extends SchemaItemBase {
  type: 'radioButton'
  options?: RadioButtonOption[]
  attrs?: RadioGroupProps
  link?: Record<string | number, SchemaItem[]>
}
interface SchemaItemCustom extends SchemaItemBase {
  type: 'custom'
  /** 对应生产者中的 `${name}.config.vue` */
  name: string
  attrs?: Record<string, any>
}

type SchemaItem = SchemaItemInput
  | SchemaItemNumber
  | SchemaItemCheckbox
  | SchemaItemSwitch
  | SchemaItemSelect
  | SchemaItemRadio
  | SchemaItemRadioButton
  | SchemaItemDatetimePicker
  | SchemaItemColorPicker
  | SchemaItemStyleNumber
  | SchemaItemCustom
```
