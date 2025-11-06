---
title: DND Editor
layout: home

hero:
  name: "DND Editor"
  text: "可视化页面编辑器"
  tagline: 基于Web Components的页面编辑器
  actions:
    - theme: brand
      text: 文档
      link: /base/introduction
    - theme: alt
      text: 示例
      link: /demo
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
  <mpd-editor />
</template>

<script setup lang="ts">
import { useEditor } from './composable.ts'

const editor = useEditor()

async function init() {
  await editor.register()
  // 编辑器的其它初始化逻辑
}
</script>
```

``` ts [composable.ts]
import { nextTick, ref } from 'vue'

export function useEditor() {
  // 由于编辑器的js较大，使用异步加载可以显著提升首屏速度
  const dnde = import('@sepveneto/dnde/core')
  const render = ref(false)
  const { promise, resolve } = Promise.withResolvers()

  async function register() {
    (await dnde).register()
    render.value = true
    nextTick().then(resolve)
  }

  return {
    render,
    register,
  }
}
```
:::
