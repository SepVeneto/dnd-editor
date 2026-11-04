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
空状态示例、Markdown、reasoning、工具调用、数据事件、流式文本、停止生成和历史记录，
全部位于 `dnd-agent` 的 Shadow DOM 内。
