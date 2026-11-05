# `@sepveneto/dnde-agent`

装修助手以一个独立自定义元素接入编辑器。Agent 实现来自
`llm-agent`：Agents SDK 负责 Agent Loop、工具调用、流式输出和会话历史；
本包只保留 Web Component 外壳、宿主 API 协议和业务工具适配。

## 接入

宿主提供编辑器 API、业务工具和运行时上下文：

```vue
<dnd-agent
  :api="agentApi"
  :tools="businessTools"
  :context="getContext"
></dnd-agent>
```

直接导入元素入口会自动注册 `<dnd-agent>`：

```ts
import '@sepveneto/dnde-agent/element'
```

也可以由编辑器在 `register({ agent })` 中按需注入：

```ts
register({
  remoteUrl,
  agent: () => import('@sepveneto/dnde-agent/element'),
})
```

## 宿主 API

```ts
interface AgentHostApi {
  model?: {
    baseURL?: string
    model?: string
    apiMode?: 'responses' | 'chat_completions'
  }
  editor?: {
    getCurrentEditor: () => unknown | Promise<unknown>
    getWidgets: () => unknown | Promise<unknown>
    operateEditor: (operation: AgentEditorOperation) => unknown | Promise<unknown>
  }
}
```

默认带三个基于编辑器 API 的工具：`get_current_editor`、`get_widgets`、
`editor_operator`。写操作和历史不可逆操作应先取得用户确认。

### 初始化与增量修改

Agent 会先读取 `get_current_editor` 的快照，再结合用户当前消息、聊天记录和
附件内容判断工作模式：

- **初始化**：用户要求按清单、文档或整页需求从零创建页面，或明确要求重建；
- **增量修改**：用户要求在现有页面上新增、编辑、删除或移动局部内容。

页面已有内容、但请求又像是一份完整清单时，Agent 会先向用户确认是否覆盖，
不会自行清空页面。初始化和增量修改都可以通过同一个 `editor_operator` 写入，
区别在于进入初始化后需要先调用宿主提供的初始化工具。

宿主可以提供一个 `initialization` 角色的工具。主 Agent 判断为初始化后，通过
`start_initialization` 暂时移交给独立的初始化子 Agent；子 Agent 只绑定这个
指定名称的工具，调用完成后通过 `finish_initialization` 交还主 Agent。用户交互、
业务接口查询以及返回数据都由宿主工具自己决定：

```ts
import {
  defineInitializationTool,
} from '@sepveneto/dnde-agent'
import { z } from 'zod'

const confirmInitialization = defineInitializationTool({
  name: 'confirm_initialization',
  description: '让用户确认本次初始化方式。',
  parameters: z.object({
    checklistSummary: z.string().optional(),
  }),
  async execute({ checklistSummary }) {
    return host.confirmInitialization(checklistSummary)
  },
})
```

提供这个工具后，主 Agent 不会直接调用它，也不会把它暴露在普通增删改流程中。
初始化子 Agent 仅能使用该工具，不能使用编辑器工具或其他业务工具。工具返回后
控制权交还主 Agent，由主 Agent 重新确认组件类型并通过 `editor_operator`
创建页面。未提供初始化工具时，Agent 会在对话中询问用户是否按清单继续。

初始化工具必须返回以下三种结果之一：

```ts
{ mode: 'custom' } // 模型按用户清单自主设计
{
  mode: 'reference',
  referenceId: '用户输入的参考数据 ID',
  referenceData: { /* 宿主根据 ID 查询到的实际参考数据 */ }
}
{ mode: 'cancelled' } // 用户取消初始化
```

`reference` 模式必须由用户提供参考数据 ID。宿主工具应使用该 ID 调用参考数据
详情接口，并把实际数据作为 `referenceData` 返回给主 Agent；主 Agent 不得自行
选择、编造参考项，也不得只凭裸 ID 继续。完成选择后，仍按正常编辑流程依次调用
可用组件查询、业务数据工具和 `editor_operator`，不会跳过业务工具直接生成业务
数据。

### 图片参考

输入框支持多选和分批追加附件，包括 `.docx` 文档以及 JPG、PNG、WebP、BMP、
TIFF、HEIC 图片；一次最多 6 个附件、总计不超过 20 MB。例如可以同时上传一份
装修文档和一张参考图。文档会逐个转换为文本上下文，所有图片会作为多模态内容
一起发送。图片上传后显示缩略图，Agent 会读取图片的布局、层级、间距、比例、
配色和组件关系，再结合当前编辑器和可用组件执行初始化或增量修改。图片中的
业务数据不会被当作真实接口数据，商品等内容仍须通过宿主业务工具准备。

本地图片遵循千问 OpenAI 兼容接口的多模态格式：BFF 将图片转换为
`data:image/<type>;base64,...`，与文本一起放入同一条用户消息。会话历史保存
图片引用而不是 Base64，避免撑满浏览器 `localStorage`。例如把 `qwen3.6-plus`
作为模型时，可以直接使用“参考这张图的布局设计首页”这类指令。包含图片的
Qwen 对话会使用官方文档中的 Chat Completions 兼容格式；纯文本对话继续遵循
宿主配置的 API 模式。

图片输入格式参考千问官方文档：
<https://help.aliyun.com/zh/model-studio/vision>。

### 添加组件时的业务数据

`items` 通常是由业务 ID 查询并组装的复杂数据，不能交给模型生成。业务工具
应把组装结果写入当前 Agent Run 的 Context，`editor_operator` 会在 `add`
时自动注入，并在操作成功后一次性消费：

```ts
const queryProduct = defineAgentTool({
  name: 'query_product',
  description: '查询商品并准备添加到编辑器。',
  parameters: z.object({ keyword: z.string() }),
  async execute({ keyword }, toolContext) {
    const product = await api.product.search(keyword)
    const items = await api.product.buildEditorItems([product.id])

    // 只返回模型需要做决策的轻量信息。
    toolContext.context.pendingItems = items
    return { id: product.id, name: product.name }
  },
})
```

模型随后只调用
`editor_operator({ action: 'add', widget: 'product', target: '页面节点 UUID' })`。
工具参数不包含 `items`；即使模型额外传入也会被移除。每次 Agent Run 都会
创建独立的 Context，失败时保留待添加数据以支持同一轮重试，成功后清空。
同一轮模型回复中的 function tools 会按调用顺序串行执行，保证前序工具写入的
Context 在后续工具（例如 `editor_operator`）执行时已经可见。

## 业务工具

```ts
import { defineAgentTool } from '@sepveneto/dnde-agent'
import { z } from 'zod'

const queryOrder = defineAgentTool({
  name: 'query_order',
  description: '查询订单状态',
  parameters: z.object({ id: z.string() }),
  async execute({ id }, context) {
    return fetch(`/api/orders/${id}`).then(response => response.json())
  },
})
```

工具的 `execute` 在浏览器内运行，并可读取宿主通过 `context` 注入的只读上下文。
模型请求走兼容 OpenAI 的宿主代理/BFF，浏览器侧不保存真实密钥。

## UI

UI 保留原装修助手的悬浮按钮交互。展开后使用 `llm-agent` 的聊天视图：
空状态示例、图片/文档附件、Markdown、reasoning、工具调用、数据事件、流式文本、停止生成和历史记录，
全部位于 `dnd-agent` 的 Shadow DOM 内。
