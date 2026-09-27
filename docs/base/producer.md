---
title: 生产者
---

# 生产者

生产者负责提供所有编辑器需要用到的代码。

编辑器会根据编辑区用户的布局，通过生产者的渲染入口从对应的目录下找到并加载相应的代码，最终渲染到编辑区或配置区。

## 模块联邦

生产者通过`模块联邦`暴露两个模块：

| 名称 | 文件 | 说明 |
| --- | --- | --- |
| `./remote` | `src/components/remoteRender.vue` | 统一的渲染入口，根据`scope`与`type`动态加载对应组件 |
| `./setup` | `src/setup.ts` | 注册需要共享的插件与样式 |

`./setup`需要导出两个字段：

```ts
// src/setup.ts
import ElementPlus from 'element-plus'
import ElementPlusCss from 'element-plus/dist/index.css?inline'

// 编辑器创建应用时会依次 app.use(plugin, options)
export const use = [{ plugin: ElementPlus, options: {} }]
// 需要注入到编辑器 shadow dom 中的样式
export const styles = [ElementPlusCss.replace(':root', ':host')]
```

::: warning
生产者的样式不会自动注入。编辑器会把`./setup`导出的`styles`挂载到自己的`shadow dom`中，因此组件库的全局样式需要在这里显式导出（通常需要把`:root`替换为`:host`）。
:::

## 构建配置

生产者需要接入`@sepveneto/dnd-plugins`，以获得`shadow dom`下的样式加载与模块缓存清理能力：

```ts
// rsbuild.config.ts
import { pluginEditor } from '@sepveneto/dnd-plugins'

export default defineConfig({
  plugins: [
    pluginEditor(moduleFederationConfig),
    pluginModuleFederation(moduleFederationConfig),
    // ...
  ],
})
```

## 目录结构

这里只列举了关键的目录结构

```
.
├── src
│   ├── components
│   │   └── remoteRender.vue   // 渲染入口，编辑器通过它加载下面各目录的组件
│   ├── config                 // 配置区组件表单，${type}.config.vue
│   ├── helper                 // 编辑区操作栏图标，${name}.vue
│   ├── icons                  // 组件区图标，${name}.vue
│   ├── skeleton               // 组件区 tab 扩展内容，${name}.vue
│   ├── setup.ts               // 暴露给编辑器的插件与样式
│   └── widgets                // 编辑区组件视图，${type}.view.vue
├── module-federation.config.ts
└── rsbuild.config.ts
```

编辑器按下面的规则解析文件：

| scope | 目录 | 文件名 |
| --- | --- | --- |
| `widgets` | `src/widgets` | `${type}.view.vue` |
| `config` | `src/config` | `${type}.config.vue` |
| `helper` | `src/helper` | `${name}.vue` |
| `icons` | `src/icons` | `${name}.vue` |
| `skeleton` | `src/skeleton` | `${name}.vue` |

其中`type`是组件（`widget.create`的`type`）或扩展名称（`helper`/`icons`/`skeleton`使用的`name`），详见[视图和配置](../usage/viewconfig.md)。
