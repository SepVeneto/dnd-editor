# `@sepveneto/dnde-agent`

`@sepveneto/dnde-agent` 提供 Web Component 外壳和最小 Agent Runtime。运行时本身只有
一个主 Agent；主 Agent 不持有任何 function tool，只通过 handoff 调度宿主提供的子
Agent。

本包同时公开版本化的编辑器 DSL，以及给宿主子 Agent 使用的 DSL 工具。具体业务角色、
业务工具和编辑策略均由宿主定义。

## 接入

宿主提供模型配置、编辑器 DSL API、子 Agent 和运行上下文：

```vue
<dnd-agent
  :api="agentApi"
  :sub-agents="subAgents"
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

编辑器侧通过 `<mpd-editor :agent-sub-agents="subAgents">` 注入子 Agent。

## Runtime 边界

- 运行时只构造固定主 Agent `Diy Copilot`。
- 主 Agent 的 `tools` 始终为空，只负责分诊和 handoff。
- 子 Agent 由宿主定义，或直接注入已经构造好的 Agents SDK `Agent`。
- 子 Agent 负责实际分析、业务查询和页面编辑。
- 未提供匹配子 Agent 时，主 Agent 会说明当前能力不足，不会自行读取或修改页面。

这种边界可确保业务权限、工具实现和具体编辑策略不进入 Agent Runtime。

## 宿主 API

编辑器向 Runtime 提供查询、校验和应用 DSL 所需的能力；宿主需要将导出的 DSL 工具
显式加入具体子 Agent 的 `tools`：

```ts
import type { AgentHostApi } from '@sepveneto/dnde-agent'

const agentApi: AgentHostApi = {
  model: {
    baseURL: 'http://localhost:4000/v1',
    model: 'qwen3.6-plus',
    apiMode: 'responses',
  },
  editor: {
    getCurrentEditor: () => editor.getAgentEditor(),
    getWidgets: () => editor.getCapabilities(),
    validateDsl: dsl => editor.validateDsl(dsl),
    applyDsl: dsl => editor.applyDsl(dsl),
    undo: revision => editor.undo(revision),
  },
}
```

`<mpd-editor>` 会自动注入这组编辑器 API，业务宿主通常只需配置 `model`。

## 宿主子 Agent

宿主直接使用 OpenAI Agents SDK 创建子 Agent，并将 `Agent[]` 传给编辑器：

```ts
import {
  Agent,
  createEditorDslTools,
  type AgentSubAgent,
} from '@sepveneto/dnde-agent'

const editorTools = createEditorDslTools(agentApi)

const pageAgent = new Agent({
  name: 'Page Agent',
  handoffDescription: '处理页面布局、组件编辑和业务数据查询。',
  model: 'qwen3.6-plus',
  instructions: [
    '先调用 get_current_editor 和 get_widgets。',
    '页面修改必须通过 apply_editor_dsl 提交完整、版本化的 DSL。',
    '完成后直接结束并返回处理结果。',
  ].join('\n'),
  tools: [
    ...editorTools,
    queryProduct,
    queryCoupon,
  ],
})

const subAgents: AgentSubAgent[] = [pageAgent]
```

`Agent` 会原样成为主 Agent 的 handoff 值，模型、工具、结构化输出等配置都由宿主
决定。运行时不会重复创建 Agent、包装 handoff 或适配普通工具定义，也不会修改子
Agent 的 `handoffs`。

只读子 Agent 不添加 `editorTools` 即可，不会自动获得文档修改能力。结构化输出等其它
SDK 能力直接在创建 Agent 时配置 `outputType`。

## 编辑器 DSL

Agent 不提供节点级增删改工具，而是将完整 DSL 作为一个受校验、可批量执行的操作批次：

```ts
interface EditorDsl {
  dslVersion: '1.1'
  baseRevision: number
  scope: {
    mode: 'style_only' | 'content_only' | 'layout_only' | 'any'
    targets: string[]
  }
  operations: Array<
    | {
        op: 'add'
        key: string
        widget: string
        placement?: {
          afterUuid?: string
          beforeUuid?: string
          afterKey?: string
          beforeKey?: string
          group?: string
        }
        props?: Record<string, unknown>
        style?: Record<string, unknown>
        custom?: DslCustomOperation[]
      }
    | {
        op: 'update'
        uuid: string
        props?: Record<string, unknown>
        style?: Record<string, unknown>
        custom?: DslCustomOperation[]
      }
    | {
        op: 'delete'
        uuid: string
      }
  >
}
```

`baseRevision` 必须来自 `get_current_editor`。宿主在应用前校验 revision、组件能力、
字段作用域；整批操作由编辑器原子执行。

### 公开 DSL 工具

`createEditorDslTools(api)` 是可选导出，不会由 Runtime 自动注册。将返回值展开到某个
子 Agent 自己的 `tools` 中后，该子 Agent 才会获得以下工具：

| 工具 | 作用 |
| --- | --- |
| `get_current_editor` | 读取文档、选中节点和 revision |
| `get_widgets` | 读取组件能力目录 |
| `validate_editor_dsl` | 校验 DSL，不修改文档 |
| `apply_editor_dsl` | 校验后一次性应用 DSL |
| `undo_editor_dsl` | 按 revision 撤销最近一次 DSL 操作 |

也可以通过 `CreateEditorDslToolsOptions` 只注册需要的工具。不需要编辑器能力时，
直接省略 `createEditorDslTools(api)`。

所有 DSL 类型，包括 `EditorDsl`、`DslOperation`、`DslValidationResult`，均从
`@sepveneto/dnde-agent` 导出。

## 业务工具

业务工具属于宿主，由宿主挂到具体子 Agent 上。工具可以把需要跨工具共享的数据写入
当前 Run 的 Context：

```ts
import { tool } from '@sepveneto/dnde-agent'

const queryProduct = tool({
  name: 'query_product',
  description: '查询商品并准备添加到编辑器。',
  parameters: {
    type: 'object',
    properties: {
      keyword: { type: 'string' },
    },
    required: ['keyword'],
    additionalProperties: false,
  },
  strict: false,
  async execute(input, runContext) {
    const { keyword } = input as { keyword: string }
    const product = await api.product.search(keyword)
    runContext.context.product = product
    return { id: product.id, name: product.name }
  },
})
```

宿主初始 Context 会复制到当前 Run。模型请求走宿主代理或 BFF，浏览器侧不保存真实
密钥。

## 附件与会话

输入框支持多选附件，包括 `.docx`、JPG、PNG、WebP、BMP、TIFF 和 HEIC；一次最多
6 个附件、总计不超过 20 MB。文档会转换为文本上下文，图片以千问 OpenAI 兼容的多模态
格式发送。会话历史保存图片引用而不是 Base64。

聊天 UI、流式输出、reasoning、工具调用、停止生成和历史记录全部位于
`<dnd-agent>` 的 Shadow DOM 内。
