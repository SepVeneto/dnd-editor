# `@sepveneto/dnde-agent`

装修助手以一个独立自定义元素接入编辑器。Agent 实现来自
`llm-agent`：Agents SDK 负责 Agent Loop、工具调用、流式输出和会话历史；
本包只保留 Web Component 外壳、宿主 API 协议和业务工具适配。

## 接入

宿主提供编辑器 API、业务工具、可选的业务子 Agent 和运行上下文：

```vue
<dnd-agent
  :api="agentApi"
  :tools="businessTools"
  :sub-agents="specialistAgents"
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

默认编辑器工具包括 `get_current_editor`、`get_widgets`、
`add_editor_node`、`update_editor_node` 和 `delete_editor_node`。添加组件时，
模型使用 `get_widgets` 返回的 widget 类型和该组件声明的标准字段。

### 主 Agent 与宿主子 Agent

编辑器运行时只提供主 Agent。主 Agent 负责分诊请求，并直接处理简单、局部的页面
编辑命令。专业子 Agent 由宿主按业务场景提供，编辑器不内置具体业务角色。

```ts
import type { AgentSubAgentDefinition } from '@sepveneto/dnde-agent'

const specialistAgents: AgentSubAgentDefinition[] = [{
  name: 'Layout Agent',
  handoffDescription: '处理复杂布局和多组件组织请求。',
  handoffToolName: 'handle_layout',
  instructions: [
    '先读取当前文档和组件目录，再规划组件与布局。',
    '使用 get_widgets 返回的 widget 类型调用 add_editor_node。',
    '完成后调用 return_to_main_agent 交还控制权。',
  ].join('\n'),
  tools: [],
}]
```

宿主定义子 Agent 的角色、instructions 和专业工具；编辑器为每个子 Agent 注入同一套
编辑器查询和 DSL 工具，并自动建立主 Agent 到子 Agent 及子 Agent 返回主 Agent 的
handoff。通过 `<dnd-agent :sub-agents="specialistAgents">` 或
`<mpd-editor :agent-sub-agents="specialistAgents">` 注入。

未注入子 Agent 时，主 Agent 独立处理可用工具范围内的请求，不会假设存在未注册的专业
能力。子 Agent 完成、取消或用户切换回简单命令时，通过默认的
`return_to_main_agent` 交还控制权；宿主也可用 `returnToolName` 自定义工具名。

### 图片参考

输入框支持多选和分批追加附件，包括 `.docx` 文档以及 JPG、PNG、WebP、BMP、
TIFF、HEIC 图片；一次最多 6 个附件、总计不超过 20 MB。例如可以同时上传一份
装修文档和一张参考图。文档会逐个转换为文本上下文，所有图片会作为多模态内容
一起发送。图片上传后显示缩略图，Agent 会按以下顺序执行：

1. 解析图片的布局、层级、间距、比例、配色和组件关系，确定需要的组件角色及数量；
2. 查询可用组件，结合组件功能描述和用户需求，先规划每个组件承载的内容；
3. 组件和内容计划完成后，再通过宿主业务工具准备需要的数据。

图片、文档等参考附件可以辅助布局，包括层级、间距、比例、配色和组件关系。
模型不参与业务数据选择、直填或拼装，只负责根据意图调用宿主工具。业务工具负责
查询、校验和准备数据；模型不得改写、推断或自行生成接口动态数据。缺少影响操作
正确性的信息时应先询问用户。
数据准备边界不影响编辑器 DSL 工具的正常调用：模型仍必须调用
`get_current_editor` 读取页面、调用 `get_widgets` 查询组件，并通过
`add_editor_node`、`update_editor_node`、`delete_editor_node` 修改节点。
意图工具和业务工具只负责准备数据，不能替代编辑器 DSL 操作。

本地图片遵循千问 OpenAI 兼容接口的多模态格式：BFF 将图片转换为
`data:image/<type>;base64,...`，与文本一起放入同一条用户消息。会话历史保存
图片引用而不是 Base64，避免撑满浏览器 `localStorage`。例如把 `qwen3.6-plus`
作为模型时，可以直接使用“参考这张图的布局设计首页”这类指令。包含图片的
Qwen 对话会使用官方文档中的 Chat Completions 兼容格式；纯文本对话继续遵循
宿主配置的 API 模式。

图片输入格式参考千问官方文档：
<https://help.aliyun.com/zh/model-studio/vision>。

### 业务数据

业务数据通常由业务工具查询并组装，不能交给模型生成：

```ts
const queryProduct = defineAgentTool({
  name: 'query_product',
  description: '查询商品并准备添加到编辑器。',
  parameters: z.object({ keyword: z.string() }),
  async execute({ keyword }, toolContext) {
    const product = await api.product.search(keyword)
    // 只返回模型需要做决策的轻量信息。
    toolContext.context.product = product
    return { id: product.id, name: product.name }
  },
})
```

业务工具可以把需要跨工具共享的数据写入当前 Run 的 Context。编辑器工具只接收
通用组件操作，不定义具体业务数据结构。

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

宿主提供的初始 Context 会复制到当前 Agent Run，并由 SDK 正常透传给业务工具和
编辑器 API。工具只读取 `runContext.context`，不会直接调用宿主的 `getContext`。
模型请求走兼容 OpenAI 的宿主代理/BFF，浏览器侧不保存真实密钥。

## UI

UI 保留原装修助手的悬浮按钮交互。展开后使用 `llm-agent` 的聊天视图：
空状态示例、图片/文档附件、Markdown、reasoning、工具调用、数据事件、流式文本、停止生成和历史记录，
全部位于 `dnd-agent` 的 Shadow DOM 内。
