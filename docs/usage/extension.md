---
title: 扩展
---

# 扩展

由于编辑器本身是独立打包的，考虑到实际使用时往往会有各种各样的需求，因此提供了扩展机制，开发者可以通过`editor.register`自行丰富编辑器的功能。

## 编辑区

编辑区支持通过`helper`来扩展选中组件后的操作栏。同时也可以对内置的操作进行细化。

比如内置的`删除`操作只有指定的组件才能使用，也需要针对每个组件支持导出具体数据方便debug，可以按照如下方式进行扩展：

``` ts
// 元素渲染之后就可以调用，编辑器还没挂载完也没关系（调用会先排队）
editorRef.value?.register(ctx => ({
  init() {
    ctx.plugins.helper.addBuiltin({
      name: 'delete',
      condition: (node: any) => {
        // 这里就指定了卡片和轮播组件不可删除
        return !['card', 'banner'].includes(node.type)
      },
    })

    // 这里扩展了导出操作
    ctx.plugins.helper.addBuiltin({
      // 编辑器会根据这个名称加载图标
      // 如果找不到，会尝试加载生产者提供的图标
      // 查找路径 /helper/export.vue
      name: 'export',
      title: '导出组件配置',
      // 这里定义了点击后的操作
      action: (node) => {
        console.log('export', node)
      },
      // 默认所有组件都可以使用
      condition: (node) => {
        return true
      },
    })
  },
}))  
```

## 组件区

组件区可以通过扩展`tab栏`的方式，让使用者有更多的选择，比如可以预置多个模板。

``` ts
editorRef.value?.register(ctx => ({
  init() {
    // 注册成功后当选中模板时
    // 编辑器会从/skeleton/template.vue中加载文件并渲染出来
    ctx.plugins.widget.addPanel({
      label: '模板',
      name: 'template'
    })
  }
}))
```

## 配置区

配置区默认分为`属性`和`样式`两个部分。

`config.addPanel` 用于给**根节点（页面级）补充配置**：它只是给配置区多加一个标签，标签里放业务侧定义的根配置项。它**不一定对应独立组件**——可能只是出于业务需要，把一组配置单独归到一个标签里。

当这些配置要驱动一个**位置固定、组件区（widgets）不自由提供的组件**（例如右下角浮窗）时，通过可选的 `component` 传入该组件：编辑器会把它作为独立节点绑定到根节点上（不进入页面布局的拖拽列表，因此**不可拖曳、不可删除**，始终以预览态渲染），并可在选中它后配置内容。

- 两份配置相互独立，**都由业务侧定义**，编辑器不注入任何配置项：
  - **根配置（`attributes`）**：本标签里的配置项，绑定在 `rootNode.data[name]` 下；
  - **组件内容（`component.schema.props`）**：选中该组件后于「属性」中编辑；
- 若 `attributes` 里定义了 `isShow` 开关，编辑器会按它决定是否渲染预览
  （与 `Node.visible` 同一约定：默认显示，`isShow` 为假值时隐藏）；
- 点击编辑区里的组件预览即可选中它，进而配置内容；
- 两份数据都会维护进 `getData()`，根配置挂在根节点 `data` 的 `name` 下。

下面分别演示「标签 + 可选组件」与「纯配置标签」：

``` ts
import { schema, widget } from '@sepveneto/dnde-core/helper'

editorRef.value?.register(ctx => ({
  init() {
    // 标签 + 可选组件：维护一个位置固定的浮窗
    ctx.plugins.config.addPanel({
      label: '浮窗',
      name: 'dialog',
      // 根配置（页面级）完全由业务侧定义，显示开关也在这里
      attributes: [
        schema.switch({ label: '显示', key: 'isShow' }),
        schema.number({ label: '浮窗层级', key: 'zIndex' }),
      ],
      // 可选：不传就只是一个纯配置标签
      component: widget.create({
        name: '浮窗',
        type: 'dialog',
        // 默认隐藏，配合根配置里的显示开关
        defaultData: { isShow: 0 },
        // 组件自身的定位样式，absolute 相对手机屏幕定位到右下角
        defaultStyle: {
          position: 'absolute',
          width: 48,
          height: 48,
          bottom: 20,
          right: 20,
        },
        // 组件自身的内容配置项，选中该组件后于「属性」中编辑
        attributes: [
          schema.input({ label: '标题', key: 'title' }),
        ],
      }),
    })

    // 纯配置标签：不关联组件，只是给根节点补充一组配置
    ctx.plugins.config.addPanel({
      label: '页面设置',
      name: 'pageSettings',
      attributes: [
        schema.switch({ label: '允许分享', key: 'shareable' }),
      ],
    })
  }
}))
```

组件视图仍按 `${type}.view.vue` 的约定在 `src/widgets/` 目录下查找，节点的 `data` 会作为 `props.config` 传入。
