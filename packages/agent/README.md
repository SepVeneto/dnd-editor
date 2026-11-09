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
  debug?: {
    startAt: 'prepare_initialization'
    prepareInitialization: {
      intent: string
      components: Array<{ key: string, type: string }>
      resources: Array<{
        component: string
        type: 'link' | 'app' | 'coupon'
        required: boolean
        query: string
      }>
    }
  }
  editor?: {
    getCurrentEditor: () => unknown | Promise<unknown>
    getWidgets: () => unknown | Promise<unknown>
    operateEditor: (operation: AgentEditorOperation) => unknown | Promise<unknown>
  }
}
```

默认编辑器工具包括 `get_current_editor`、`get_widgets`、
`prepare_initialization`、`add_editor_node`、`update_editor_node` 和
`delete_editor_node`。所有写操作必须先有 IR。

### 调试模式

配置 `api.debug` 后，运行时会在模型调用前使用手工 mock 参数执行
`prepare_initialization`，并把这次工具调用及结果加入当前 Run。模型从资源查询和
组件操作继续。用户消息只负责触发起始步骤，不会传给模型，也不参与生成或改写 IR，
因此输入任意内容都等价于“已经得到预置 IR”。调试运行使用独立会话，不会读取聊天历史或
附件内容。

```ts
const agentApi: AgentHostApi = {
  debug: {
    startAt: 'prepare_initialization',
    prepareInitialization: {
      intent: '调试金刚区初始化',
      components: [{ key: 'entry-grid', type: 'jgq' }],
      resources: [],
    },
  },
}
```

该模式复用正常工具的规范化、能力目录校验和 `locationId` 生成逻辑。mock 入参不合法时
不会启动模型，聊天面板会展示 `prepare_initialization` 的失败结果。

### 主 Agent 与宿主子 Agent

编辑器运行时只提供主 Agent。主 Agent 负责分诊请求，并直接处理简单、局部的页面
编辑命令。专业子 Agent 由宿主按业务场景提供，编辑器不再内置配置清单或其它业务角色。

```ts
import type { AgentSubAgentDefinition } from '@sepveneto/dnde-agent'

const specialistAgents: AgentSubAgentDefinition[] = [{
  name: 'Configuration Checklist Agent',
  handoffDescription: '处理配置清单、需求文档、整页方案和多组件配置请求。',
  handoffToolName: 'handle_configuration_checklist',
  instructions: [
    '你负责解析配置清单并生成初始化 IR。',
    '先读取当前文档和组件目录，再调用 prepare_initialization。',
    '按宿主资源查询结果和 IR 顺序调用 add_editor_node。',
    '完成后调用 return_to_main_agent 交还控制权。',
  ].join('\n'),
  tools: [queryAppResources, queryCouponResources, queryLinkResources],
}]
```

宿主定义子 Agent 的角色、instructions 和专业工具；编辑器为每个子 Agent 注入同一套
编辑器查询、IR 和 DSL 工具，并自动建立主 Agent 到子 Agent及子 Agent 返回主 Agent的
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
2. 查询可用组件，结合组件功能描述和清单配置需求，先规划每个组件承载的内容；
3. 整页组件和内容计划完成后，再查询业务数据，并通过显式 `locationId` 和当前工具 Context 填充内容。

图片、文档等参考附件可以辅助布局，包括层级、间距、比例、配色和组件关系。
模型不参与数据选择、直填或拼装，只负责根据意图调用宿主工具。本项目的
`query_internal_routes` 是内部路由意图工具：模型只传入页面名称、路由名称或
路径关键词，宿主匹配 `entry.dialog` 的 `H5Entry` 静态路由，将结果写入
`context`。编辑器不会从 Context 自动注入隐藏数据；后续工具必须显式读取当前
调用传入的 Context 和资源位置，模型不得改写、推断或自行生成路由及其它填充数据。应用名称、卡券品牌、会员直充分类、落地页、商品、
价格等接口动态内容不能从参考附件中提取或作为候选，只能根据用户当前请求中的
需求清单并通过宿主业务工具获取或准备。所有填充内容都必须来自需求清单或宿主
工具写入的 Context；清单中没有提供的内容不能从参考附件、模型推测或既有经验
中补全，缺少必要内容时应先询问用户。参考附件中出现品牌信息不构成指定或授权。
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

### 添加组件时的业务数据

业务数据通常由业务 ID 查询并组装，不能交给模型生成，也不通过 Context
自动注入。查询工具只把结果保存在宿主 Context；后续 DSL 工具在调用时读取
传入的 Context 和资源位置：

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

配置清单初始化使用 `add_editor_node({ resourceId }, context)`。模型只传
IR 位置的 `resourceId`；宿主从
`context.initialization.locations[resourceId]` 读取 widget、标准属性和资源。
模型不再传 `widget`、`items`、`changes`、props 或 style。

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
