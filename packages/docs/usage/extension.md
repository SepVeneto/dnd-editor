---
title: 扩展
---

# 扩展

由于编辑器本身是独立打包的，考虑到实际使用时往往会有各种各样的需求，因此提供了扩展机制，开发者可以通过`editor.register`自行丰富编辑器的功能。

## 编辑区

编辑区支持通过`helper`来扩展选中组件后的操作栏。同时也可以对内置的操作进行细化。

比如内置的`删除`操作只有指定的组件才能使用，也需要针对每个组件支持导出具体数据方便debug，可以按照如下方式进行扩展：

``` ts
// 编辑器的引用，需要在注册之后才能获取到
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

配置区默认分为`属性`和`样式`两个部分，可以通过`config.addPanel`来扩展额外的区块。

比如需要一个页面级的弹窗，可以按照如下方式进行扩展：

``` ts
editorRef.value?.register(ctx => ({
  init() {
    ctx.plugins.config.addPanel({
      label: '弹窗',
      name: 'dialog',
      attributes: [
          schema.switch({ label: '是否展示', key: 'needOpen' }),
      ]
    })
  }
}))
```
