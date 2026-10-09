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
    :widgets="widgets"
    :extra="editor.extra"
  />
</template>

<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useEditor } from './composable.ts'
import { widgets } from './widgets.ts'

const editorRef = useTemplateRef('editor')
const editor = useEditor()

mockApi().then((res) => {
  editor.waitForMounted.then(() => {
    // 设置编辑器数据
    editorRef.value.setData(res)
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
  const dnde = import('@sepveneto/dnde')
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
    // remoteUrl 指向生产者（组件视图）的部署地址
    (await dnde).register({ remoteUrl })
    render.value = true
    nextTick().then(resolve)
  }

  return {
    waitForMounted: promise,
    render,
    register,
    extra,
  }
}
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

## 注册

编辑器的自定义元素需要先通过`register`注册，`remoteUrl`指向生产者（组件视图）的部署地址：

```ts
import { register } from '@sepveneto/dnde'

await register({ remoteUrl: 'http://localhost:8090' })
```

`register`的可选配置：

| 名称 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| injectGlobalStyle | boolean | true | 是否把 element-plus 主题与生产者声明的 `setup.styles` 再挂一份到宿主页面的`document.head`，用于兜住 teleport 到`document.body`的弹层（`ElDialog`、`ElSelect` 下拉、`ElTooltip`、`createDialog` 等） |

::: tip
弹层会被 teleport 到`document.body`，不在编辑器的`shadow dom`内，因此需要一份挂在宿主页面上的样式。默认开启；如果宿主已有自己的 element-plus 全局样式、不希望页面里再多一份，可以关闭（关闭后需自行保证这些弹层的样式，也可以稍后手动调用导出的`injectPopperStyles`）。

命令式弹层（如 `@sepveneto/basic-comp` 的 `createDialog`）会在独立的渲染根里渲染，只继承编辑器 app 级别的 provide；编辑器已经把 element-plus 命名空间（`mpd`）与业务上下文（`editorContextKey`）补到 app 级别，因此这类弹层既能拿到正确的样式命名空间，也能在组件内 `inject(editorContextKey)` 取到编辑器上下文。
:::

## 属性

| 名称 | 类型 | 必填 | 默认值 | 说明 |
| ---- | ---- | ---- | ----- | ---- |
| name | string | × | widgets | 视图的名称，用于删除缓存 |
| widgets | LikeWidget[] | × | [] | 组件区中展示的组件 |
| extra | Object | × | {} | 宿主中需要传递给编辑器的数据 |

## 事件

| 名称 | 参数 | 说明 |
| :--- | :-- | :--- |
| change | <Desc desc="any">data</Desc> | 配置区/编辑区数据变化时触发（内部做 1s 防抖） |

## 方法

| 名称 | 类型 | 说明 |
| ---- | ---- | ---- |
| register | <Desc desc="(fn: (ctx: Editor) => { init: () => void }) => void">Function</Desc> | 注册扩展 |
| validate | <Desc desc="() => Promise<void>" :raw="false">Function</Desc> | 验证配置区数据，校验失败时抛出异常 |
| getData | <Desc desc="() => any">Function</Desc> | 获取编辑区的数据 |
| setData | <Desc desc="(data: any) => void">Function</Desc> | 设置编辑区的数据 |
