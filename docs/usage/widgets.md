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
  // 组件视图名称，生产者会按 `${type}.view.vue` 查找
  type: 'card',
  // 组件在编辑器中的交互配置
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

::: warning
`config`对应组件在编辑器中的交互配置（内部映射为`meta`），不要与组件数据混淆。
:::

## 内置方法

除了`widget.create`，还提供几个常用封装：

| 方法 | 说明 |
| --- | --- |
| `widget.create(config)` | 创建普通组件 |
| `widget.root(config)` | 创建页面根节点，`type`固定为`page`，且不会出现在组件区 |
| `widget.columnContainer(config)` | 创建栅格容器，`type`为`containerGrid`，可容纳子组件 |
| `widget.group(name, list)` | 把多个组件归到组件区的同一个分组下 |

## 根节点

编辑器默认存在一个根节点，也就是页面本身，可以认为是一个全局组件。一般可以用来配置主题色或者弹窗通知之类的。

```ts
const rootPage = widget.root({
  name: '页面',
  attributes: [
    schema.input({ label: '标题', key: 'title' }),
  ],
})
```

等价于通过`widget.create`创建一个`type: 'page'`的组件：

```ts
const rootPage = widget.create({
  name: '页面',
  type: 'page',
  // 由于是作为根节点设置，所以不需要它出现在组件区
  config: { visible: false },
})
```

::: tip
编辑器只会把`type === 'page'`的组件作为根节点。如果没有提供，编辑器会使用一个空的默认页面。
:::

## 组件分组

组件区支持分组展示，通过`widget.group`把多个组件放到同一个分组下：

```ts
export const widgets = [
  widget.group('基础组件', [card, richText]),
  widget.group('业务组件', [menu]),
]
```

## 类型定义

::: details 显示类型定义
```ts twoslash
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import type { CSSProperties } from 'vue'

interface WidgetPos {
  x?: number
  y?: number
  width?: number
  height?: number
}

interface CWidget {
  /**
   * 组件名称
   */
  name: string
  /**
   * 组件视图名称，生产者按 `${type}.view.vue` 查找
   */
  type: string
  /**
   * 组件图标，生产者按 `icons/${icon}.vue` 查找
   */
  icon?: string
  /**
   * 组件在编辑器中的交互配置
   */
  config?: {
    /**
     * 在编辑区是否允许拖拽
     */
    draggable?: boolean
    /**
     * 在组件区是否可见
     */
    visible?: boolean
    /**
     * 在编辑区是否固定，一般与 draggable 配合使用，达到类似 header 的效果
     */
    fixed?: boolean | 'header' | 'footer'
  }
  /**
   * 是否把组件视为容器处理
   */
  isContainer?: boolean
  /**
   * 默认样式
   */
  defaultStyle?: CSSProperties & WidgetPos
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
  _uuid?: string
  _name: string
  _view: string
  _icon?: string
  container?: boolean
  isShow?: boolean
  meta?: {
    draggable?: boolean
    visible?: boolean
    fixed?: boolean | 'header' | 'footer'
  }
  schema?: {
    props?: SchemaItem[]
    style?: SchemaItem[]
  }
  style?: CSSProperties & WidgetPos
  data?: Record<string, any> | any[]
}
```
:::
