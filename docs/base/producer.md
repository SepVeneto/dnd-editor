---
title: 生产者
---

# 生产者

生产者负责提供所有编辑器需要用到的代码。

编辑器会根据编辑区用户的布局，通过生产者的几个渲染入口从对应的目录下找到并加载相应的代码，最终渲染到编辑区或配置区。

## 目录结构

这里只列举了关键的目录结构

```
.
├── package.json
├── rspack.config.ts
└── src
    ├── components
    │   ├── remoteRender.vue // 渲染入口
    ├── config // 配置区组件表单
    │   └── datepicker.config.vue
    ├── helper // 编辑区操作栏扩展
    │   └── export.vue
    ├── icons // 组件区图标扩展
    │   └── column.vue
    ├── skeleton // 组件区tab栏扩展
    │   └── template.vue
    └── widgets // 编辑区组件视图
        ├── card.view.vue
        ├── image.view.vue
        ├── menuItem.view.vue
        └── reserve.view.vue
```
