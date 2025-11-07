---
title: 数据
---

# 数据

组件中的数据都是通过`schema`来定义的，其中`attributes`用来定义组件的属性，`stylesheet`用来定义组件的样式。

## 数据校验

支持`required`快速设置必填校验，同时也支持通过`rules`进行自定义校验。关于`rules`的用法，可以参见[element-plus](https://element-plus.org/zh-CN/component/form#%E8%A1%A8%E5%8D%95%E6%A0%A1%E9%AA%8C)

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
| schema.select | 选择框，备选项通过`options`设置 |
| schema.radio | 单选框，备选项通过`options`设置|
| schema.radioButton | 单选按钮备，选项通过`options`设置 |
| schema.switch | 开关 |
| schema.time | 时间选择器 |
| schema.color | 颜色选择器 |
| schema.styleNumber | 样式数字输入框 |

## 自定义类型

当内置类型无法满足需求时，可以通过`schema.custom`自定义类型。

## 类型定义

``` ts twoslash
interface BaseConfig {
  /**
   * 标签文本
   */
  label: SchemaItem['label']
  /**
   * 数据键名
   */
  key: SchemaItem['key']
  /**
   * 对于这个属性的提示信息
   */
  tips?: string
  /**
   * 表单域的属性
   */
  formItem?: Partial<FormItemProps>
  /**
   * 是否必填，可以是一个字符串
   */
  required?: boolean | string
  /**
   * 具体的表单校验规则
   */
  rules?: SchemaItem['rules']
}

interface SchemaItem {
  label: string
  key: string
  formItem?: Partial<FormItemProps>
  rules?: FormItemRule | FormItemRule[]
}
```
