---
title: 视图和配置
---

# 视图和配置

编辑区和配置区所有的内容都会被视为一个独立的组件。

## 编辑区

对于编辑区中各组件的`type`，会按 `${type}.view.vue` 的文件名在 `src/widgets/` 目录下查找。

视图组件通过`props.config`获取当前节点的数据（即`node.data`），在容器内渲染时还会额外拿到`props.style`（即`node.style`）。

```vue
<script setup lang="ts">
const props = defineProps<{
  config: Record<string, any>
  style?: Record<string, any>
}>()
</script>
```

::: warning
当前根级节点（直接放在页面下的组件）与容器内节点的渲染参数并不一致：根级渲染传入的`config`是节点实例本身，容器内渲染传入的`config`才是节点数据。业务组件如需同时兼容两种位置，建议优先读取`data`字段或做兼容处理。这是已知的待统一项。
:::

## 配置区

对于编辑区中组件的`type`，会按 `${type}.config.vue` 的文件名在 `src/config/` 目录下查找。

在编写时可以利用`defineModel`快速创建一个双向绑定的数据。

### 可读的属性

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| modelValue | any | 组件指定key的数据 |
| config | SchemaItem | 组件指定key的配置 |
| data | Record<string, any> | 组件的数据 |

组件额外传入的`config.attrs`会被展开到组件上（`v-bind`）。

::: warning
注意区分组件数据和组件指定key的数据，简单的说，`组件数据`是指组件在编辑区中包含所有配置的数据集合，而`组件指定key的数据`仅代表组件在编辑区中某一个配置项的数据。
:::

## 依赖注入

生产者的整个生命周期都会被注入组合编辑器提供的依赖。因此可以在任何一个组件中通过`inject`注入依赖，注入的`key`为`@sepveneto/dnde-core`导出的`editorContextKey`。

当需要在编辑器中直接调用接口，或是有事件需要通知宿主环境时，都可以使用依赖注入。

```ts
import { editorContextKey } from '@sepveneto/dnde-core'
import type { EditorContext } from '@sepveneto/dnde-core'
import { inject } from 'vue'

const editor = inject<EditorContext>(editorContextKey)
```

### 属性

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| node | Node | 当前选择的节点 |
| plugins | <Desc desc="{ helper: HelperPlugin, widget: WidgetPlugin, config: ConfigPlugin }">Object</Desc> | 插件集合 |
| bus | EventEmitter | 事件总线，用于向宿主派发事件 |
| extra | Record<string, any> | 从宿主环境中传递的额外的数据 |
| preview | boolean \| undefined | 是否处于预览态，预览态下应禁用拖拽、缩放等编辑交互 |
| updateConfig | (data: any) => void \| undefined | 通知编辑器组件配置已变更 |

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
  get info(): { style: CSSProperties } & Record<string, any>
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
