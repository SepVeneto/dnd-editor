# Editor Agent + MF Capability 结构

## 1. 整体结构

系统只有三类角色：

```text
                    ┌──────────────┐
                    │     宿主      │
                    │   Host App    │
                    └──────┬───────┘
                           │ 集成 / 配置
                           ↓
                ┌──────────────────────┐
                │        Editor        │
                │                      │
                │   Agent Runtime      │
                │   Capability Registry│
                │   Semantic Resolver  │
                │   IR Executor        │
                │   DSL / Layout       │
                └───────┬───────┬──────┘
                        │       │
               MF       │       │       MF
                        ↓       ↓
                 ┌──────────┐ ┌──────────┐
                 │ Producer │ │ Producer │
                 │    A     │ │    B     │
                 └──────────┘ └──────────┘
```

角色职责：

| 角色       | 职责                                   |
| -------- | ------------------------------------ |
| 宿主       | 集成和使用 Editor                         |
| Editor   | Agent Runtime、能力编排、语义解析、IR 执行、页面布局执行 |
| Producer | 通过 MF 向 Editor 提供组件及其相关能力            |

不存在独立的 `Consumer Capability`。

---

## 2. 宿主 → Editor

宿主负责集成 Editor。

```text
Host
  ↓
Editor
```

宿主关注的是：

* 创建和配置 Editor
* 提供 Editor 所需的运行环境
* 管理 Editor 生命周期
* 获取 Editor 的编辑结果

宿主不负责：

```text
组件语义解析
组件能力注册
Agent Loop
LLM 调用
DSL 执行
```

这些都归 Editor。

因此宿主与 Editor 是：

```text
应用层
  ↓
编辑器能力层
```

---

## 3. Producer → Editor

Producer 通过 MF 接入 Editor。

现有结构：

```text
Producer
├── ./remote
├── ./setup
└── ./agent
```

职责：

```text
./remote
    → 组件渲染

./setup
    → Editor Runtime 所需的插件、样式

./agent
    → 组件的 Agent Capability
```

Producer 只需要描述自己提供的组件能力，不需要管理整个 Agent。

---

## 4. Producer Agent Capability

`./agent` 提供的能力主要包括：

```text
semantic
tools
skills
layout / composition
resources
```

### semantic

描述组件实例的业务语义：

```text
Component Instance
      ↓
semantic
      ↓
“优惠券 / 卡券 / 可用数量 / 去使用”
```

### tools

描述组件可以执行什么操作：

```text
coupon.setTitle
coupon.setDataSource
coupon.setDisplayMode
```

### skills

描述复杂业务操作如何完成。

例如：

```text
coupon-config
```

用于告诉 Agent 如何完成一组与优惠券相关的配置操作。

### layout / composition

描述组件适合怎样参与布局或组合。

例如：

```text
split-entry
grid-entry
banner-entry
```

以及对应的约束：

```text
split-entry
  适合 2 个入口
  横向并列
  图片型展示

grid-entry
  适合 4～12 个入口
  多列网格
  图标型展示
```

这类信息同样由 Producer 提供，而不是由 Editor 针对业务组件硬编码。

---

## 5. Editor 是 Agent Host

Editor 自己拥有通用能力：

```text
Editor
├── Agent Runtime
├── Capability Registry
├── Semantic Resolver
├── Layout Planner
├── IR Executor
└── DSL / Layout API
```

Editor 提供的是通用能力：

```text
layout.move
layout.insert
layout.delete
layout.update

page.query
component.query
component.select
```

Producer 提供的是组件/业务能力。

因此：

```text
Editor
    = Agent Host + 通用编辑能力

Producer
    = Component Capability Provider
```

---

## 6. Capability Registry

Producer 加载后，Editor 将其能力注册到统一 Registry：

```text
Capability Registry
├── Editor Core
│   ├── layout.*
│   ├── page.*
│   └── component.*
│
├── Producer A
│   ├── semantic
│   ├── tools
│   ├── skills
│   └── layout patterns
│
└── Producer B
    ├── semantic
    ├── tools
    ├── skills
    └── layout patterns
```

这样 Editor 不需要预先知道具体业务组件是什么。

---

## 7. 用户编辑已有页面

例如：

> 把卖卡券的那块移到商品列表前面。

流程：

```text
用户
 ↓
LLM
 ↓
Intent IR
 ↓
Semantic Resolver
 ├── 当前页面组件树
 ├── schema / 实例数据
 ├── Producer semantic
 ├── Candidate Retrieval
 └── LLM Grounding
 ↓
Resolved IR
 ↓
Capability Binding
 ↓
Editor / Producer Capability
 ↓
DSL / Layout API
```

其中：

```text
“卖卡券的那块”
        ↓
Producer semantic
        ↓
具体组件实例
```

而：

```text
“移动”
        ↓
Editor.layout.move
```

---

## 8. 根据用户需求生成新布局

例如：

> 首页需要展示 A 卡券和 B 场景两个入口。

流程与“修改已有页面”不同：

```text
用户需求
   ↓
LLM
   ↓
Requirement IR
   ↓
Layout Pattern Retrieval
   ↓
LLM Layout Planning
   ↓
Layout Plan IR
   ↓
Semantic Resolution
   ↓
Capability Binding
   ↓
IR Executor
   ↓
DSL / Layout API
```

例如：

```text
需求
“两个入口”

    ↓

Producer 提供的候选布局
├── split-entry
│   └── 适合 2 个入口横向展示
│
└── grid-entry
    └── 适合多个入口网格展示

    ↓

LLM 选择
split-entry

    ↓

解析内容
A 卡券 → Producer A
B 场景 → Producer B

    ↓

Editor 执行布局
```

这里 Editor 负责：

```text
发现能力
召回候选
组织计划
执行
```

而 Producer 负责：

```text
提供组件
提供组件语义
提供组件操作
提供适用的布局/组合方式
```

---

## 9. LLM 与 DSL 的边界

LLM 永远不直接输出：

```js
layout.move(...)
```

而输出 IR：

```text
Intent IR
      ↓
Resolved IR
      ↓
Layout Plan IR
```

Editor 再把 IR 绑定到实际 Capability，并最终执行现有 DSL。

因此：

```text
LLM
 ↓
IR
 ↓
Editor
 ↓
Capability
 ↓
DSL
```

DSL 是 Editor 的执行实现，不是 LLM 协议。

---

## 10. 最终结构

```text
                         ┌──────────────┐
                         │     宿主      │
                         │   Host App    │
                         └──────┬───────┘
                                │
                                ↓
              ┌────────────────────────────────┐
              │              Editor             │
              │                                 │
              │       Agent Runtime             │
              │             │                   │
              │      Capability Registry        │
              │             │                   │
              │      ┌──────┴──────┐            │
              │      ↓             ↓            │
              │ Semantic Resolver  Layout Planner│
              │      │             │            │
              │      └──────┬──────┘            │
              │             ↓                   │
              │          IR Executor            │
              │             ↓                   │
              │       DSL / Layout API          │
              └─────────────┬───────────────────┘
                            │
                    MF      │      MF
                            ↓
                 ┌────────────────────┐
                 │      Producer      │
                 │                    │
                 │ remote             │
                 │ setup              │
                 │ agent              │
                 │                    │
                 │ semantic           │
                 │ tools              │
                 │ skills              │
                 │ layout patterns    │
                 └────────────────────┘
```

核心边界：

> **宿主负责使用 Editor；Editor 负责 Agent 和页面执行；Producer 负责向 Editor 提供组件及组件相关能力。**

这样就不再存在 `Consumer Capability` 这个概念。宿主和生产者是 Editor 的两类外部角色，但只有 Producer 向 Editor 提供组件级/布局级 Agent Capability。

---

## 11. Playground

`playground/` 是 Agent 的本地调试页，用来在不接入宿主的情况下跑通
`Agent` 的 runtime、消息结构和四种 message part 的渲染。

```bash
# 仓库根目录
pnpm dev:agent
# 或者
pnpm -C packages/agent dev
```

默认地址为 <http://localhost:8083>。

页面分两栏：

```text
┌──────────────────────────┬───────────────┐
│  ChatPanel               │  Inspector    │
│  · 直接驱动 Agent runtime │  · 运行时快照  │
│  · text / action /       │  · 消息 JSON   │
│    tool-call / raw       │  · 模型配置    │
└──────────────────────────┴───────────────┘
```

模型有两档：

| 模式             | 说明                                                       |
| -------------- | -------------------------------------------------------- |
| `mock`         | 离线可用，用预置回复演示各类 part，输入「卡券 / 工具 / 布局」会触发不同 part |
| `openai`       | 走 OpenAI 兼容的 `/chat/completions` 流式接口，配置只存在浏览器 localStorage |

`playground/responders.ts` 里的 `Responder` 是模型接入点，替换它即可接入其它模型，
不需要改动 Agent 自身。`Agent` 的 `runtime.messages` / `runtime.isRunning` 就是
playground 与运行时之间唯一的接口。

---

## 12. Agent as Tool

`Agent.asTool()` 把一个子 Agent 包装成一个 `FunctionTool`，注册到「负责流程」的父
Agent 上。父 Agent 的模型会在自己的 tools 列表里看到这些子 Agent，并依据
`toolName` / `toolDescription` 自行决定调用哪个、按什么顺序调用。

```ts
const flowAgent = new Agent({
  name: 'decoration flow',
  instructions: '先校验、再标准化、最后生成布局，每一步都通过调用子 Agent 完成。',
  tools: [
    verifyAgent.asTool({
      toolName: 'verify_configuration',
      toolDescription: '校验业务配置，查询并开通未开通的场景。',
      // 子 Agent 内部的步骤 / 审批继续冒泡给宿主
      runOptions: { onEvent, onApproval },
    }),
    normalizeAgent.asTool({ toolName: 'normalize_layout_input' }),
    layoutAgent.asTool({
      toolName: 'generate_layout',
      // 调用前把宿主侧的运行数据补进子 Agent 的入参
      buildInput: input => JSON.stringify({ elements: JSON.parse(input), widgets }),
      // 把子 Agent 的结果转成返回给上层模型的字符串
      extractOutput: result => result.text,
    }),
  ],
})

await run(flowAgent, userRequest)
```

`asTool` 的选项：

| 选项               | 说明                                                        |
| ---------------- | --------------------------------------------------------- |
| `toolName`       | 暴露给上层模型的函数名，默认由 `agent.name` 规整成合法 function name    |
| `toolDescription`| 模型据此判断何时调用该子 Agent，默认取 `handoffDescription`            |
| `maxTurns`       | 子 Agent 单次运行的最大轮数                                       |
| `needsApproval`  | 调用该子 Agent 前是否需要人工确认                                   |
| `runOptions`     | 透传 `onEvent` / `onApproval`，让子 Agent 的步骤和审批冒泡到宿主         |
| `buildInput`     | 调用子 Agent 前加工入参，例如注入组件表、页面上下文                     |
| `extractOutput`  | 把子 Agent 的运行结果转成返回给上层模型的字符串                        |

也可以不使用类方法，直接调用导出的 `createAgentTool(agent, options)`，
或在需要时用 `toToolName(name)` 把任意名字转成合法 function name。

本仓库的装修流程就是按这个方式组织的：`flow.ts` 在模块加载时用 `registerAgent`
把 `normalize_layout_input` / `generate_layout` 两个子 Agent 注册成工具，
工具之间通过模块级共享 state 传递中间结果；setup 阶段调用 `createDecorationFlowAgent()`
（不需要传参）构建一次流程 Agent，工具直接从注册表取。`send` 只把用户输入原样交给它，
由模型选择调用顺序与参数，宿主再从共享 state 拿布局结果。

### 12.1 外部注册：`registerAgent`

外部能力方不需要拿到流程 Agent，也不需要改流程 Agent 的 `tools`，
只要调用 `registerAgent` 把自己的子 Agent 注册成 agent tool 即可：

```ts
import { registerAgent } from '@agent/sdk'

registerAgent(couponAgent, {
  toolName: 'configure_coupon',
  toolDescription: '配置优惠券组件的标题、数据源与展示方式。',
})
```

流程 Agent 在构建时会自动把注册表里的工具并进 `tools`（显式配置的同名工具优先），
之后模型就能像调用内置子 Agent 一样选择它。注册表 API：

| API                        | 说明                              |
| -------------------------- | ------------------------------- |
| `registerAgent(agent, opt)`| 注册并返回对应的 `FunctionTool`，同名覆盖     |
| `unregisterAgent(name)`    | 取消注册，返回是否移除成功                  |
| `listRegisteredAgents()`   | 当前已注册的工具名                      |
| `getRegisteredAgentTools(names?)` | 取出工具，传 `names` 可按给定顺序过滤 |
| `clearRegisteredAgents()`  | 清空注册表                          |

### 12.2 审批：状态在 Agent，配置在 tool

工具声明 `needsApproval` 后，运行时会在调用前暂停等用户决定。审批的**文案与回调**
和 `needsApproval` 一样写在 tool 上，**状态**（待处理请求、暂停 / 恢复）由 Agent 管理：

```ts
const enableSceneTool = tool({
  name: 'enable_scene',
  parameters: z.object({ id: z.number(), name: z.string() }),
  needsApproval: true,
  approval: {
    message: input => `场景「${input.name}」未开通，是否需要开通？`,
    onApprove: input => console.log('同意开通', input),
    onReject: input => console.log('拒绝开通', input),
  },
  invoke: async input => { /* ... */ },
})
```

| 位置                          | 说明                                                    |
| --------------------------- | ----------------------------------------------------- |
| `tool.approval.message/onApprove/onReject` | 审批文案与同意 / 拒绝后的回调（业务侧配置）                    |
| `agent.approval.pending`    | 当前待确认请求（Agent 内部状态），没有则为 null                     |
| `agent.approval.message`    | 当前请求的文案（来自 tool 的 `approval.message`）              |
| `agent.approval.approve()` / `reject()` | 给出决定，随后触发 tool 的 `onApprove` / `onReject`        |

UI（`MpdAgent` / `AssistantThread`）直接读 `agent.approval.pending` 渲染审批面板，
按钮调用 `approve` / `reject`。`run(agent, input, { onApproval })` 可以临时覆盖审批处理；
`asTool` 的子 Agent 默认沿用父级 Agent 的审批，所以注册的子 Agent 里 `needsApproval`
的工具也会冒泡到同一个面板。
