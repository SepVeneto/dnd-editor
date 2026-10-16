---
title: 快速开始
---

# 快速开始

## 环境支持

利用`vue3`的`custom element`实现，因此不支持ie11

| ![IE](https://cdn.jsdelivr.net/npm/@browser-logos/edge/edge_32x32.png) | ![Firefox](https://cdn.jsdelivr.net/npm/@browser-logos/firefox/firefox_32x32.png) | ![Chrome](https://cdn.jsdelivr.net/npm/@browser-logos/chrome/chrome_32x32.png) | ![Safari](https://cdn.jsdelivr.net/npm/@browser-logos/safari/safari_32x32.png) |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Edge ≥ 79                                                              | Firefox ≥ 78                                                                      | Chrome ≥ 64                                                                    | Safari ≥ 12                                                                    |

## 安装

根据项目的lock文件选择对应的安装方式

::: code-group
```shell [pnpm]
pnpm i @sepveneto/dnde @sepveneto/dnde-core
```

```shell [yarn]
yarn add @sepveneto/dnde @sepveneto/dnde-core
```

```shell [npm]
npm i @sepveneto/dnde @sepveneto/dnde-core
```
:::

其中`@sepveneto/dnde`是编辑器（消费者），`@sepveneto/dnde-core`提供`widget`、`schema`等用于描述组件的工具函数。

## 用法

编辑器被导入时就会注册`<mpd-editor>`自定义元素，`register`需要传入生产者（组件视图）的部署地址：

```ts
import { register } from '@sepveneto/dnde'

register({ remoteUrl: 'http://localhost:8090' })
```

```html
<mpd-editor></mpd-editor>
```

::: tip
`register`是幂等的，同一个`remoteUrl`重复调用会复用同一次注册结果。
:::

### 渲染时机

宿主的`import`和`register`都是异步的，但**渲染`<mpd-editor>`不需要等它们**，不需要`v-if`之类的时序控制：

- `import`之后元素就已经注册好，模板里可以直接写`<mpd-editor>`；
- 真正的编辑器要等`register`拿到生产者地址、生产者的`setup`加载完成之后才挂载，这期间元素会显示自带的加载占位；
- 挂载前调用`setData`、`register`等方法会先排队，挂载后按顺序补上（`await`在这些方法上始终成立）。

因此「先渲染再注册」和「先注册再渲染」都是合法的，宿主只需要在合适的时机调用`register`即可：

```vue
<template>
  <mpd-editor ref="editor" :widgets="widgets" />
</template>

<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import { register } from '@sepveneto/dnde'

const editorRef = useTemplateRef('editor')

register({ remoteUrl: 'http://localhost:8090' })

onMounted(async () => {
  // 挂载前调用会先排队，挂载后自动补上
  editorRef.value.setData(await mockApi())
})
</script>
```

::: tip
`<mpd-editor>`是自定义元素，需要告诉`vue`不要在编译期把它当成组件解析，否则控制台会有`Failed to resolve component`告警：

```ts
// vite.config.ts
vue({
  template: { compilerOptions: { isCustomElement: tag => tag === 'mpd-editor' } },
})
```
:::

#### 需要更小的首屏体积时

编辑器产物较大，若希望把它拆成独立的`chunk`，可以改成动态`import`：此时只有`import`本身需要等待，`register`与编辑器的挂载都不用等：

```vue
<template>
  <mpd-editor v-if="ready" ref="editor" :widgets="widgets" />
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'

const ready = ref(false)
const editorRef = useTemplateRef('editor')

import('@sepveneto/dnde').then(({ register }) => {
  register({ remoteUrl: 'http://localhost:8090' })
  // 元素在 import 时就已经注册好，渲染之后指令式 API 立即可用（挂载前的调用会排队）
  ready.value = true
})
</script>
```

### 最佳实践

以`vue3`为例

::: code-group
``` vue [demo.vue]
<template>
  <mpd-editor
    ref="editor"
    :widgets="widgets"
    :extra="extra"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { register } from '@sepveneto/dnde'
import { widgets } from './widgets.ts'

const editorRef = useTemplateRef('editor')
const extra = {
  // 可以是文件上传之类的接口，也可以直接共享 store
}

// 只需要把生产者（组件视图）的地址交给编辑器，不用 await，也不需要用返回值控制渲染时机
register({ remoteUrl: 'http://localhost:8090' })

mockApi().then((res) => {
  // 编辑器可能还没挂载完：这里调用会先排队，挂载后自动补上
  editorRef.value.setData(res)
})

async function getEditorData() {
  // 校验编辑器数据是否合法
  await editorRef.value.validate()

  // 获取编辑器数据
  return editorRef.value.getData()
}
</script>
```

``` ts [widgets.ts]
import { schema, widget } from '@sepveneto/dnde-core'

// 这里是指定页面的配置，也就是默认的根节点
// 根节点必须使用 type: 'page'
const rootPage = widget.create({
  name: '活动设置',
  type: 'page',
  config: {
    visible: false,
  },
  attributes: [
    schema.input({ label: '活动名称', key: 'name', required: true }),
  ],
  stylesheet: [
    schema.color({ label: '背景颜色', key: 'background' }),
    schema.custom({
      type: 'image',
      label: '背景图片',
      key: 'backgroundImage',
      attrs: {
        limit: [750, 488],
        width: '375px',
        height: '244px',
        background: true,
      },
    }),
  ],
})

const richText = widget.create({
  name: '富文本',
  type: 'richText',
  defaultStyle: { width: 355, minHeight: 32, marginBottom: 10 },
  defaultData: { isShow: 1 },
  attributes: [
    schema.custom({
      label: '',
      type: 'richText',
      key: 'content',
      formItem: { labelWidth: '0' },
    }),
  ],
})

export const widgets = [
  rootPage,
  richText,
]
```
:::
