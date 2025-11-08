---
title: 视图和配置
---

# 视图和配置

编辑区和配置区所有的内容都会被视为一个独立的组件。

## 编辑区

对于编辑区中各组件的`type`，会按`${type}.view.vue`的文件名在`src/widgets/`目录下查找。

在编写时可以通过`props.config`获取当前组件的所有数据，具体有哪些属性参见[类型说明](#类型说明)

一般来说，只需要获取`props.config.data`，根据配置区的数据进行渲染即可。

## 配置区

对于编辑区中各组件的`type`，会按`${type}.config.vue`的文件名在`src/config/`目录下查找。

在编写时可以利用`defineModel`快速创建一个双向绑定的数据。

### 可读的属性

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| modelValue | any | 组件指定key的数据 |
| config | SchemaItem | 组件指定key的配置 |
| data | Record<string, any> | 组件的数据 |

::: warning
注意区分组件数据和组件指定key的数据，简单的说，`组件数据`是指组件在编辑区中包含所有配置的数据集合，而`组件指定key的数据`仅代表组件在编辑区中某一个配置项的数据。
:::

## 依赖注入

生产者的整个生命周期都会被注入组合编辑器提供的依赖。因此可以在任何一个组件中通过`inject`注入依赖。

当需要在编辑器中直接调用接口，或是有事件需要通知宿主环境时，都可以使用依赖注入。

### 属性

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| node | Node | 当前选择的节点 |
| plugins | <Desc desc="{ helper: HelperPlugin, widget: WidgetPlugin, config: ConfigPlugin }">Object</Desc> | 插件集合 |
| bus | EventEmitter | 事件总线 |
| extra | Record<string, any> | 从宿主环境中传递的额外的数据 |

## 类型说明

```ts twoslash
declare class Node {
  level: number
  wid: string
  widget: Readonly<Widget>
  parent?: Node
  list: Node[]
  data: Record<string, any>
  style: CSSProperties
  hovering: boolean
  dragging: boolean
  constructor(widget: Widget, info?: {
    uuid?: string
    props?: Node['data']
    style?: Node['style']
    list?: Node['list']
  })
  get info(): {
    style: CSSProperties
  }
  get isContainer(): boolean
  get hasList(): boolean
  get mouseover(): boolean
  get type(): string
  get name(): string
  get visible(): boolean | undefined
  validate(only?: boolean): Promise<string | undefined>
  triggerHover(hover: boolean): void
  setList(list: Node[]): void
  copy(): Node
  parse(): Record<string, any>
}
```
