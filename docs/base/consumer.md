---
title: 消费者
---

# 消费者

消费者由宿主引入，是用户交互的主要区域。

## 示例

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

## 属性

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| ---- | --- | ---- | ----- | ---- |
| remoteUrl | string | √ | - | 视图的远程地址 |
| name | string | × | widgets | 视图的名称，这里用于删除缓存 |
| widgets | LikeWidget[] | × | [] | 组件区中展示的组件 |
| extra | Object | × | {} | 宿主中需要传递给编辑器的数据 |

## 事件

| 名称 | 参数 | 说明 |
| :--- | :-- | :--- |
| onChange | <Desc desc="any">data</Desc> | 配置区/编辑区数据变化时触发 |

## 方法

| 名称 | 类型 | 说明 |
| :--- | :-- | :--- |
| register | <Desc desc="(fn: (ctx: Editor) => void) => { init: () => void }">Function</Desc> | 注册扩展 |
| validate | <Desc desc="() => Promise<void>" :raw="false">Function</Desc> | 验证配置区数据 |
| getData | <Desc desc="() => any">Function</Desc> | 获取编辑区的数据 |
| setData | <Desc desc="(data: any) => void">Function</Desc> | 设置编辑区的数据 |
