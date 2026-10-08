# H5 DIY Agent 平台落地设计

## 1. 目标

构建一套与具体业务解耦的 H5 DIY Agent 平台。

编辑器平台负责：

* 用户输入的顶层流程路由
* 页面编辑能力
* Layout / Edit IR
* Agent Runtime 接入
* Capability 注册与执行机制
* 多轮会话上下文
* 当前任务状态
* Workflow 执行基础设施

业务侧负责：

* 自己的业务能力
* 自己的业务 Workflow
* 业务 API / 数据处理
* 业务领域知识

核心原则：

> 编辑器不定义业务流程，业务侧不需要理解 Agent Runtime。

底层直接使用 OpenAI Agents SDK，不重复实现 Agent Loop、Tool Calling、Session、RunState、Tracing 等基础设施。Agents SDK 已提供这些能力。

---

# 2. 整体架构

```text
                              用户输入
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    Flow Agent   │
                         │   顶层流程路由   │
                         └────────┬────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
            INITIALIZE           EDIT          CAPABILITY
                 │                │                │
                 ▼                ▼                ▼
        业务侧定义 Workflow    Edit Agent    Capability Agent
                 │                │                │
                 ▼                │                ▼
          Workflow Executor       │        Business Capability
                 │                │
                 │                ▼
                 │           Edit IR
                 │                │
                 ▼                ▼
             Business          Editor
             Steps
```

底层 Agent 能力：

```text
┌─────────────────────────────────────────┐
│        Editor Agent Framework           │
│                                         │
│ Flow Agent                              │
│ Edit Agent                              │
│ Capability Registry                     │
│ Workflow Adapter                        │
│ Context Projection                      │
│ Task State                              │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│       OpenAI Agents SDK                 │
│                                         │
│ Agent                                   │
│ Runner / run()                          │
│ Function Tool                           │
│ Agents as Tools                         │
│ Session                                 │
│ RunState                                │
│ Guardrail                               │
│ Tracing                                 │
└─────────────────────────────────────────┘
```

---

# 3. 三种顶层执行模式

Flow Agent 只负责把用户输入路由到三种模式：

```ts
type FlowType =
  | 'initialize'
  | 'edit'
  | 'capability'
```

## 3.1 initialize

根据用户输入初始化页面。

初始化流程由业务侧定义。

例如：

```text
用户输入
  ↓
业务解析
  ↓
数据核查
  ↓
数据标准化
  ↓
Layout Agent
  ↓
Layout IR
```

也可以是：

```text
用户输入
  ↓
业务解析
  ↓
Layout Agent
  ↓
Layout IR
```

平台不预设初始化流程必须包含哪些步骤。

---

## 3.2 edit

修改当前编辑器内容。

编辑流程由编辑器平台固定。

```text
用户输入
    ↓
Edit Agent
    ↓
理解用户意图
    ↓
按需调用业务 Capability
    ↓
Edit IR
    ↓
Editor Executor
```

例如：

```text
用户：
“删除这个按钮”

        ↓

Edit Agent

        ↓

DeleteComponentIR
```

或者：

```text
用户：
“把大润发小时达加进去”

        ↓

Edit Agent
        ↓
queryScenario
        ↓
业务数据
        ↓
AddComponentIR
```

编辑流程允许模型自行决定是否调用业务能力。

---

## 3.3 capability

当用户输入没有匹配初始化或编辑操作时，尝试作为业务能力调用。

例如：

```text
用户：
“检查一下大润发小时达有没有开通”

        ↓

Capability Agent

        ↓

checkScenario

        ↓

业务接口

        ↓

返回结果
```

这里不要求生成 IR。

---

# 4. Flow Agent

Flow Agent 是平台提供的顶层 Agent。

它只负责：

```text
判断当前用户请求属于：

initialize
edit
capability
```

Flow Agent 不负责：

* 业务流程内部编排
* 业务 API 调用
* 页面具体修改
* 业务数据解析
* 业务数据核查

例如：

```ts
const flowAgent = new Agent({
  name: 'Flow Agent',

  instructions: `
判断用户请求属于：
1. initialize：初始化页面
2. edit：修改当前页面
3. capability：执行独立业务能力

只负责顶层路由，不执行具体业务操作。
`,

  outputType: flowOutputSchema,
})
```

---

# 5. Flow Agent 与其他 Agent 的关系

建议采用 Manager / Agents-as-tools 模式。

```text
Flow Agent
    │
    ├── initializeWorkflow
    ├── editAgent
    └── capabilityAgent
```

而不是直接 handoff。

原因是 Flow Agent 是顶层控制者。

例如：

```ts
const flowAgent = new Agent({
  name: 'Flow Agent',

  tools: [
    initializeWorkflowTool,
    editAgent.asTool({
      toolName: 'edit',
      toolDescription: '修改当前编辑器内容',
    }),
    capabilityAgent.asTool({
      toolName: 'capability',
      toolDescription: '执行业务能力',
    }),
  ],
})
```

Agents SDK 原生支持 `agent.asTool()`；它会把 Agent 包装成 Function Tool，并在 Tool 被调用时运行子 Agent，同时保持主 Agent 的控制权。

---

# 6. Business Capability

业务侧不直接注册 Agent。

业务侧注册 Capability。

```ts
interface CapabilityDefinition<
  TInput = unknown,
  TOutput = unknown,
> {
  name: string

  description: string

  inputSchema: Schema<TInput>

  outputSchema?: Schema<TOutput>

  execute(
    input: TInput,
    context: CapabilityContext,
  ): Promise<TOutput>
}
```

例如：

```ts
const queryScenario = defineCapability({
  name: 'queryScenario',

  description: '根据场景名称查询业务场景数据',

  inputSchema: z.object({
    name: z.string(),
  }),

  async execute({ name }) {
    return await api.queryScenario(name)
  },
})
```

业务侧只需要关心：

```text
能力是什么
输入是什么
输出是什么
怎么执行
```

不需要关心：

```text
Agent
Runner
Tool
Prompt
Session
Handoff
```

---

# 7. Capability Registry

编辑器平台维护 Capability Registry。

```ts
class CapabilityRegistry {
  register(
    capability: CapabilityDefinition
  ): void

  get(
    name: string
  ): CapabilityDefinition | undefined

  list(): CapabilityDefinition[]

  getTools(): FunctionTool[]
}
```

注册：

```ts
registry.register(queryScenario)
registry.register(checkScenario)
registry.register(queryMerchant)
```

平台内部将 Capability 转换成 Agents SDK 的 Function Tool。

Agents SDK 原生支持将 TypeScript 函数包装成带 Schema 的 Function Tool。

```text
Business Capability
        ↓
Capability Adapter
        ↓
Agents SDK FunctionTool
        ↓
Agent
```

业务侧完全不知道中间存在这个 Adapter。

---

# 8. Capability Tool Adapter

```ts
function capabilityToTool(
  capability: CapabilityDefinition,
) {
  return tool({
    name: capability.name,

    description: capability.description,

    parameters: capability.inputSchema,

    async execute(input, context) {
      return capability.execute(
        input,
        context.context.business,
      )
    },
  })
}
```

这样：

```text
queryScenario
```

最终在 Agent 中表现为：

```text
queryScenario(...)
```

模型只看到：

* name
* description
* input schema
* output

不需要知道具体实现。

---

# 9. Edit Agent

Edit Agent 是编辑器平台固定提供的 Agent。

```ts
const editAgent = new Agent({
  name: 'Edit Agent',

  instructions: EDIT_AGENT_INSTRUCTIONS,

  tools: capabilityRegistry.getTools(),

  outputType: editIROutputSchema,
})
```

它拥有：

```text
用户输入
当前编辑器上下文
可用业务 Capability
```

并输出：

```text
Edit IR
```

例如：

```json
{
  "type": "add",
  "component": "...",
  "data": "..."
}
```

或者：

```json
{
  "type": "delete",
  "targetId": "..."
}
```

---

# 10. Capability Agent

Capability Agent 用于处理独立业务操作。

```ts
const capabilityAgent = new Agent({
  name: 'Capability Agent',

  instructions: `
根据用户输入选择最合适的业务能力。
只能调用已注册的 Capability。
如果没有合适能力，不要编造能力。
`,

  tools: capabilityRegistry.getTools(),
})
```

例如：

```text
用户：
检查一下当前配置的场景

        ↓

Capability Agent

        ↓

checkScenario({
  scenarios: ...
})
```

---

# 11. Business Workflow

Workflow 完全属于业务侧。

平台不定义具体业务 Workflow。

业务侧可以定义：

```ts
const initializeWorkflow = defineWorkflow({
  name: 'initialize',

  steps: [
    parseScenarioStep,
    verifyScenarioStep,
    normalizeScenarioStep,
    generateLayoutStep,
  ],
})
```

也可以：

```ts
const initializeWorkflow = defineWorkflow({
  name: 'initialize',

  steps: [
    parseProductStep,
    generateLayoutStep,
  ],
})
```

不同业务之间可以完全不同。

---

# 12. Workflow Step

```ts
interface WorkflowStep<TContext = unknown> {
  name: string

  execute(
    context: TContext
  ): Promise<TContext>
}
```

Step 可以由：

```text
普通代码
API
Capability
Agent
```

实现。

例如：

```ts
const verifyScenarioStep = defineStep({
  name: 'verifyScenario',

  async execute(context) {
    const result = await checkScenario.execute(
      context.scenarios,
      context,
    )

    return {
      ...context,
      verification: result,
    }
  },
})
```

---

# 13. Workflow Executor

确定性的 Workflow 不需要 Agent Runtime。

直接使用普通 TypeScript 执行。

```ts
async function executeWorkflow(
  workflow: Workflow,
  context: WorkflowContext,
) {
  let current = context

  for (const step of workflow.steps) {
    current = await step.execute(current)
  }

  return current
}
```

因此：

```text
Workflow
   ↓
普通代码控制顺序
   ↓
Step
   ↓
必要时调用 Agent
```

而不是：

```text
Workflow
   ↓
Agent 决定每一步
```

这样可以保证业务侧定义的顺序不会因为模型判断产生偏差。

---

# 14. Workflow Step 调用 Agent

如果某个 Step 需要 LLM：

```ts
const parseStep = defineStep({
  name: 'parseScenario',

  async execute(context) {
    const result = await run(
      parseAgent,
      context.userInput,
      {
        context,
      },
    )

    return {
      ...context,
      parsed: result.finalOutput,
    }
  },
})
```

OpenAI Agents SDK 的 `run()` 已经负责 Agent loop、Tool 调用以及继续运行等逻辑。

因此平台不需要重新实现：

```text
LLM
 ↓
Tool Call
 ↓
Tool Execute
 ↓
Tool Result
 ↓
LLM
```

---

# 15. Workflow 的注册

业务侧：

```ts
registerWorkflow({
  name: 'initialize',
  workflow: initializeWorkflow,
})
```

平台 Registry：

```ts
class WorkflowRegistry {
  register(workflow: Workflow): void

  get(name: string): Workflow | undefined

  list(): Workflow[]
}
```

Flow Agent 不需要理解 Workflow 内部。

它只需要知道：

```text
initialize:
根据用户输入初始化页面
```

真正执行时：

```text
Flow Agent
   ↓
initialize
   ↓
Workflow Registry
   ↓
Workflow Executor
```

---

# 16. Workflow Adapter

如果希望 Flow Agent 统一通过 Tool 调用业务 Workflow，可以将 Workflow 包装成 Tool：

```ts
function workflowToTool(
  workflow: Workflow,
) {
  return tool({
    name: workflow.name,

    description: workflow.description,

    parameters: workflow.inputSchema,

    async execute(input, context) {
      return executeWorkflow(
        workflow,
        {
          ...context.context,
          input,
        },
      )
    },
  })
}
```

最终：

```text
Flow Agent
   │
   ├── initialize
   │
   ├── edit
   │
   └── capability
```

其中：

```text
initialize
    ↓
Business Workflow Tool
    ↓
Workflow Executor
```

---

# 17. 多轮会话

多轮对话不应该只依赖 `messages[]`。

系统维护三个独立状态：

```text
Conversation
    │
    ├── Conversation History
    │
    ├── Task State
    │
    └── Editor State
```

## 17.1 Conversation History

由 OpenAI Agents SDK Session 管理。

```ts
const session = new OpenAIConversationsSession({
  conversationId,
})
```

或者使用自定义 Session Backend。

Agents SDK 的 Session 会在运行前读取历史，并在运行结束后保存新的输入和输出；Session 接口也允许接入自己的存储实现。

---

# 18. Task State

Task State 由平台自己维护。

```ts
interface TaskState {
  id: string

  flowType:
    | 'initialize'
    | 'edit'
    | 'capability'

  workflowId?: string

  stepId?: string

  status:
    | 'running'
    | 'waiting_user'
    | 'completed'
    | 'failed'

  data: unknown
}
```

例如：

```json
{
  "id": "task_001",
  "flowType": "initialize",
  "workflowId": "coupon-page",
  "stepId": "verify",
  "status": "waiting_user",
  "data": {
    "pending": [
      "大润发小时达"
    ]
  }
}
```

---

# 19. 用户继续操作

如果上一轮存在：

```text
status = waiting_user
```

下一轮用户输入不应该重新让 Flow Agent 判断流程。

例如：

```text
Agent：
“大润发小时达尚未开通，是否继续？”

User：
“继续”
```

系统应该：

```text
User Input
    ↓
检查 Active Task
    ↓
waiting_user
    ↓
Resume Workflow
```

而不是：

```text
“继续”
    ↓
Flow Agent
    ↓
initialize / edit / capability
```

---

# 20. RunState 与 Task State 的区别

OpenAI Agents SDK 提供 `RunState`，可以保存和恢复 Agent Run。它属于 Agent Runtime 层。

因此：

```text
RunState
    = Agent 当前运行状态

TaskState
    = 业务 Workflow 当前状态
```

两者不能混为一谈。

例如：

```text
TaskState
    workflow = initialize
    step = verify
    status = waiting_user
```

而：

```text
RunState
    Agent
    context
    usage
    trace
    ...
```

如果只是 Agent Run 被中断，可以使用 SDK RunState 恢复。

如果是业务流程等待用户数分钟、数小时甚至更久，则使用自己的 Task State 管理。

---

# 21. Editor State

编辑器状态由编辑器自己维护。

```ts
interface EditorState {
  documentId: string

  revision: number
}
```

不要把完整页面状态作为 Conversation History 保存。

模型需要当前页面时：

```text
Edit Agent
    ↓
Editor Context
    ↓
Current Editor State
```

页面当前状态永远以 Editor 为准。

因此：

```text
Conversation History
    = 发生过什么

Task State
    = 当前正在做什么

Editor State
    = 页面现在是什么
```

---

# 22. Context Projection

虽然 Session 保存完整历史，但不同 Agent 不应该无条件读取完整历史。

每个 Agent 获得自己的 Context Projection。

例如 Flow Agent：

```text
最近用户输入
+
必要的历史
+
Active Task
+
可用 Workflow 摘要
```

Edit Agent：

```text
当前用户输入
+
当前页面
+
相关历史
+
业务 Capability
```

Business Workflow Step：

```text
当前 Workflow State
+
当前 Step 输入
+
必要的用户上下文
```

因此：

```text
Session History
       ↓
Context Projection
       ↓
Agent Input
```

而不是：

```text
Session History
       ↓
所有 Agent 全量读取
```

---

# 23. Context 对象

建议通过 Agents SDK 的 `context` 传递运行时上下文。

```ts
interface AppContext {
  sessionId: string

  task?: TaskState

  editor: {
    documentId: string
    revision: number
  }

  capabilities: CapabilityRegistry

  business: unknown
}
```

调用：

```ts
await run(flowAgent, userInput, {
  session,
  context: appContext,
})
```

Agents SDK 的 `run()` 支持将自定义 context 传递给 Tool、Guardrail、Handoff 等运行时组件。

注意：

> Context 是运行时对象，不等于发送给模型的 Prompt。

例如：

```ts
context.editor
```

可以供 Tool 使用，但不代表完整对象自动进入模型上下文。

---

# 24. 完整请求链路

```text
                         User Input
                              │
                              ▼
                     ┌────────────────┐
                     │ Active Task ?  │
                     └───────┬────────┘
                             │
                   ┌─────────┴─────────┐
                   │                   │
                  YES                  NO
                   │                   │
                   ▼                   ▼
             Resume Task         Flow Agent
                   │                   │
                   │          ┌────────┼────────┐
                   │          │        │        │
                   │          ▼        ▼        ▼
                   │     initialize   edit   capability
                   │          │        │        │
                   │          ▼        ▼        ▼
                   │      Workflow   Edit    Capability
                   │      Executor  Agent     Agent
                   │          │        │        │
                   │          │        └──┬─────┘
                   │          │           │
                   │          ▼           ▼
                   │       Business Capabilities
                   │
                   └──────────────┬──────────────
                                  ▼
                             Result / IR
                                  │
                                  ▼
                               Editor
```

---

# 25. 推荐代码结构

```text
src/
├── agents/
│   ├── flow.ts
│   ├── edit.ts
│   └── capability.ts
│
├── capability/
│   ├── definition.ts
│   ├── registry.ts
│   └── adapter.ts
│
├── workflow/
│   ├── definition.ts
│   ├── registry.ts
│   ├── executor.ts
│   └── adapter.ts
│
├── context/
│   ├── app-context.ts
│   ├── projection.ts
│   └── session.ts
│
├── task/
│   ├── definition.ts
│   └── store.ts
│
├── editor/
│   ├── context.ts
│   └── executor.ts
│
└── runtime/
    └── run.ts
```

---

# 26. `runtime/run.ts`

这个文件不要重新实现 Agent Runtime。

它只负责把平台对象和 OpenAI Agents SDK 连接起来：

```ts
export async function runAppAgent(
  agent: Agent,
  input: string,
  options: {
    session?: Session
    context: AppContext
  },
) {
  return run(agent, input, {
    session: options.session,
    context: options.context,
  })
}
```

SDK 本身负责 Agent Loop。

---

# 27. 依赖关系

```text
Business
    │
    ├── Capability
    │
    └── Workflow
            │
            ▼
     Editor Agent Framework
            │
            ├── Flow Agent
            ├── Edit Agent
            ├── Capability Agent
            ├── Registry
            ├── Context
            └── Task State
                    │
                    ▼
          OpenAI Agents SDK
                    │
                    ▼
                  Model
```

业务侧不能反向依赖：

```text
Business
   ↓
OpenAI Agent
```

业务侧应该只依赖平台提供的：

```text
Capability API
Workflow API
```

这样未来即使底层 Agent SDK 更换，也不会影响业务定义。

---

# 28. 第一阶段实现范围

第一阶段不需要一次性实现完整平台。

建议按以下顺序落地：

### Phase 1：Capability

实现：

```text
defineCapability()
CapabilityRegistry
capabilityToTool()
```

验证：

```text
Edit Agent
    ↓
Business Capability
    ↓
API
```

跑通。

### Phase 2：Flow Agent

实现：

```text
Flow Agent
    ↓
initialize / edit / capability
```

### Phase 3：Business Workflow

实现：

```text
defineWorkflow()
WorkflowRegistry
WorkflowExecutor
workflowToTool()
```

先只支持：

```text
A → B → C
```

不要一开始实现复杂 DAG。

### Phase 4：Session

接入：

```text
OpenAI Agents SDK Session
```

再实现自己的 Session Backend。

SDK 当前 Session 已经提供持久化历史和自定义 Backend 接口。

### Phase 5：Task State

实现：

```text
running
waiting_user
completed
failed
```

重点解决：

```text
Agent → 等待用户 → 下一轮恢复 Workflow
```

### Phase 6：Context Projection

最后再根据真实上下文长度和 Agent 行为，细化：

```text
Flow Context
Edit Context
Capability Context
Workflow Context
```

---

# 29. 不自研的部分

以下能力直接使用 OpenAI Agents SDK：

```text
Agent Loop
Tool Calling
Function Tool
Agent as Tool
Handoff
Session
RunState
Streaming
Tracing
Guardrail
```

SDK 官方已经提供这些基础能力。

---

# 30. 自己实现的部分

平台真正需要维护：

```text
Flow Agent
Edit Agent
Capability Registry
Workflow Registry
Workflow Executor
Capability Adapter
Workflow Adapter
Task State
Context Projection
Editor Context
IR Executor
```

其中最核心的是：

```text
Capability
Workflow
Task State
Context
```

而不是 Agent Runtime。

---

# 31. 最终职责边界

```text
┌─────────────────────────────────────────────┐
│                  业务侧                     │
│                                             │
│  Capability                                 │
│  Workflow                                   │
│  Business API                               │
│  Business Data                              │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│                编辑器平台                   │
│                                             │
│  Flow Agent                                 │
│  Edit Agent                                 │
│  Capability Registry                        │
│  Workflow Registry                          │
│  Workflow Executor                          │
│  Task State                                 │
│  Context Projection                         │
│  Editor / IR                                │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│          OpenAI Agents SDK                  │
│                                             │
│  Agent / Runner / Tool / Session            │
│  RunState / Tracing / Guardrail             │
└─────────────────────────────────────────────┘
```

最终原则：

> **不自研 Agent Runtime，只自研适合 H5 DIY 场景的 Agent 应用层。**

其中业务侧拥有业务流程的定义权，编辑器拥有用户交互和页面编辑的控制权，OpenAI Agents SDK 负责底层 Agent 执行。

这样三方职责不会互相侵入。
