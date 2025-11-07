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

## 用法

```ts
import dnde from '@sepveneto/dnde-core'

dnde.register()
```

```html
<mpd-editor></mpd-editor>
```

### 最佳实践

以`vue3`为例

::: code-group
``` vue [demo.vue]
<template>
  <mpd-editor
    v-if="editor.render.value"
    ref="editor"
    :remote-url="editor.remoteUrl"
    :widgets="widgets"
    :extra="editor.extra"
  />
</template>

<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useEditor } from './composable.ts'
import { widgets } from './widgets.ts'

const editorRef = useTemplateRef('editor')
const editor = useEditor()

mockApi().then((res) => {
  editor.waitForMounted.then(() => {
    // 设置编辑器数据
    refEditor.value.setData(res)
  })
})

init()

async function init() {
  await editor.register()
  // 编辑器的其它初始化逻辑
}

async function getEditorData() {
  // 校验编辑器数据是否合法
  await editorRef.value.validate()

  // 获取编辑器数据
  return editorRef.value.getData()
}
</script>
```

``` ts [composable.ts]
import { nextTick, ref } from 'vue'

export function useEditor() {
  // 由于编辑器的js较大，使用异步加载可以显著提升首屏速度
  const dnde = import('@sepveneto/dnde/core')
  // 这里可以替换成loading让用户体验更友好
  const render = ref(false)
  // 区分开发环境，不推荐跨域部署
  const mode = import.meta.env.MODE
  const remoteUrl = mode === 'development'
    ? 'http://localhost:8090'
    : `${window.location.origin}/design-widgets`

  // 通过接口获取编辑器数据和编辑器初始化都是异步操作
  // 而设置数据需要等两者都完成
  const { promise, resolve } = Promise.withResolvers()

  const extra = {
    // 可以是文件上传之类的接口
    // 也可以直接共享store
  }

  async function register() {
    (await dnde).register()
    render.value = true
    nextTick().then(resolve)
  }

  return {
    waitForMounted: promise,
    render,
    register,
    remoteUrl,
    extra,
  }
}
```

``` ts [widgets.ts]
import { schema, widget } from '@sepveneto/dnde-core'

// 这里是指定页面的配置，也就是默认的根节点
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
    showSchema,
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
