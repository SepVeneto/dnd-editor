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

## 注册

`<mpd-editor>`自定义元素在编辑器被导入时即注册，`register`只负责把生产者（组件视图）的部署地址交给它：

```ts
import { register } from '@sepveneto/dnde'

register({ remoteUrl: 'http://localhost:8090' })
```

渲染`<mpd-editor>`不必等`register`返回（挂载时机由编辑器自己掌握，见[渲染时机](./quickstart.md#渲染时机)），
先渲染后注册、先注册后渲染都可以；挂载前调用的方法会先排队，挂载后自动补上。

`register`的可选配置：

| 名称 | 类型 | 默认值 | 说明 |
| ---- | ---- | ------ | ---- |
| injectGlobalStyle | boolean | true | 是否把 element-plus 主题与生产者声明的 `setup.styles` 再挂一份到宿主页面的`document.head`，用于兜住 teleport 到`document.body`的弹层（`ElDialog`、`ElSelect` 下拉、`ElTooltip`、`createDialog` 等） |

::: tip
弹层会被 teleport 到`document.body`，不在编辑器的`shadow dom`内，因此需要一份挂在宿主页面上的样式。默认开启；如果宿主已有自己的 element-plus 全局样式、不希望页面里再多一份，可以关闭（关闭后需自行保证这些弹层的样式，也可以稍后手动调用导出的`injectPopperStyles`）。

命令式弹层（如 `@sepveneto/basic-comp` 的 `createDialog`）会在独立的渲染根里渲染，只继承编辑器 app 级别的 provide；编辑器已经把 element-plus 命名空间（`mpd`）与业务上下文（`editorContextKey`）补到 app 级别，因此这类弹层既能拿到正确的样式命名空间，也能在组件内 `inject(editorContextKey)` 取到编辑器上下文。
:::

## 开发态的热更新

开发态（宿主跑着带 HMR 的开发服务器）下，编辑器的数据与组件定义都支持热更新。产物自带 Vue 与其余依赖，
宿主不需要（也用不到）自己装 Vue；宿主自己若也是 Vue 应用，两份 Vue 各自注册的组件由编辑器内部的转发器
分别转发，互不影响。产物里的 `process.env.NODE_ENV` 交给宿主的打包器替换：开发服务器会替换成开发模式，
编辑器自带的 Vue 于是带上 HMR 运行时；直接以浏览器 ESM 加载（没有打包器替换）时默认按生产模式跑。

| 改动内容 | 效果 |
| -------- | ---- |
| 生产者的组件视图（`*.view.vue`） | 画布上的组件原地更新，编辑中的数据保留 |
| 业务侧下发的组件配置（`widgets`/`schema`） | 配置面板用上新定义；编辑器数据不变，宿主页面热更新导致的重新挂载也会从快照恢复数据 |

回归用例：`node e2e/hmr.mjs`（会自己拉起生产者的 rsbuild dev 与宿主的 vite dev）。

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

::: tip
编辑器还没挂载完时调用上述方法不会失败：调用会先排队，挂载后按顺序补上（此时返回 Promise，
`await el.getData()` 这类写法在挂载前后都成立）。
:::
