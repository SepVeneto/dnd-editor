---
title: 局限性
---

# 局限性

由于编辑器是基于`web components`实现的，因此一些常见的问题同时也是存在的。

## 样式

大部分组件库一旦涉及到弹窗、悬浮框之类脱离文档流的组件，会直接插入到`document.body`中。编辑器的样式挂在`shadow dom`里，`shadow dom`外的元素拿不到，照理会出现样式丢失。

编辑器对此做了处理：element-plus 的主题会同时注入到两处——

- `shadow dom`：编辑器内部以及渲染在编辑器里的业务组件；
- `document.head`：兜住 teleport 到`document.body`的弹层（`ElDialog`、`ElSelect` 下拉、`ElTooltip` 等）。

两处用的是同一份样式（命名空间都是`mpd`），因此业务组件只要按正常方式使用 element-plus（依赖全局注册、不额外配置）即可，弹层也有样式。

::: tip
业务组件渲染在编辑器里，使用的是编辑器提供的 element-plus 实例（模块联邦共享），命名空间、locale 都跟着编辑器走，不需要也不应该再单独引入一份 element-plus。
:::

## 弹窗层级

常规的组件库中，弹窗默认插入到`document.body`中，因此往往不需要刻意调整，但是在`web components`中，编辑器自身的层级与宿主的其它浮层是各自独立的：如果宿主环境同时打开了弹窗或存在蒙层，仍然可能覆盖到编辑器之上。这类层级问题需要宿主自行协调 z-index。
