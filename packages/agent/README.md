# H5 DIY Agent 流程与业务能力架构

## 1. 设计目标

编辑器与业务侧完全解耦：

* 编辑器不感知具体业务。
* 编辑器不定义业务流程。
* 业务侧可以根据自身业务定义任意流程。
* 业务侧可以提供任意业务能力，例如接口调用、数据解析、数据核查、数据标准化等。
* 业务侧不需要直接编写 Agent 或 Prompt。
* 编辑器负责提供通用的 Agent Runtime、流程执行能力以及编辑能力。
* 模型负责用户意图识别、流程路由，以及开放式编辑场景下的业务能力选择。

整体原则：

> **业务侧定义业务流程和业务能力，编辑器负责 Agent 基础设施和编辑能力。**

---

## 2. 整体架构

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
        业务侧定义的 Workflow   Edit Agent   Capability Agent
                 │                │                │
                 │                │                ▼
                 │                │        选择业务能力并执行
                 │                │                │
                 │                ▼                │
                 │          编辑器当前内容         │
                 │                │                │
                 │                ▼                │
                 │             Edit IR             │
                 │                │                │
                 ▼                │                │
          Workflow Runtime       │                │
                 │                │                │
                 ▼                ▼                ▼
          业务能力 / Agent / API / Function
```

---

## 3. 三种执行模式

Flow Agent 对用户输入进行顶层分类，输出三种执行类型：

```ts
type FlowType =
  | 'initialize'
  | 'edit'
  | 'capability'
```

### 3.1 initialize

用于根据用户输入初始化页面。

该流程完全由业务侧定义。

例如某个业务可以定义：

```text
用户输入
  ↓
解析
  ↓
数据核查
  ↓
数据标准化
  ↓
生成 Layout IR
```

另一个业务也可以只有：

```text
用户输入
  ↓
解析
  ↓
生成 Layout IR
```

编辑器不对流程中的步骤做任何业务假设。

业务侧可以自由决定：

* 是否需要解析
* 是否需要数据核查
* 是否需要标准化
* 是否需要多个业务步骤
* 步骤执行顺序
* 步骤之间的数据传递
* 条件分支
* 是否需要 Agent
* 是否直接调用 API
* 最终如何生成编辑器能够执行的 IR

---

### 3.2 edit

用于修改当前编辑器内容。

该流程由编辑器提供，是固定的编辑流程。

```text
用户输入
   ↓
Edit Agent
   ↓
理解用户意图
   ↓
按需调用业务能力
   ↓
生成 Edit IR
   ↓
编辑器执行
```

例如：

```text
“删除首页的金刚区”
```

直接生成：

```text
DeleteComponentIR
```

例如：

```text
“把大润发小时达添加进去”
```

Edit Agent 可以根据需要：

```text
queryScenario
      ↓
获取业务数据
      ↓
生成 AddComponentIR
```

编辑流程本身不要求业务侧提供固定步骤。

业务能力是否被调用、调用哪个能力、调用参数是什么，由模型根据当前用户输入和上下文决定。

---

### 3.3 capability

当用户输入没有匹配初始化或编辑流程时，尝试直接执行对应的业务能力。

例如：

```text
“检查一下大润发小时达是否已经开通”
```

进入：

```text
Capability Agent
      ↓
选择 checkScenario
      ↓
调用业务接口
      ↓
返回结果
```

该模式主要用于业务侧已经提供能力，但用户操作并不属于页面初始化或页面编辑的情况。

---

## 4. 业务能力

业务侧向编辑器注册的是 **Capability**，而不是 Agent。

Capability 表示：

> 业务系统能够完成的一项具体能力。

例如：

```text
queryScenario
checkScenario
queryMerchant
queryCoupon
normalizeScenario
```

Capability 不限制具体实现方式。

可以是：

```text
Capability
   │
   ├── 普通函数
   ├── HTTP API
   ├── 数据库查询
   ├── LLM
   └── Agent
```

因此业务侧无需关心编辑器内部采用什么 Agent 框架。

---

## 5. Capability 定义

建议提供统一的能力描述：

```ts
interface CapabilityDefinition {
  name: string

  description: string

  inputSchema: Schema

  outputSchema: Schema

  execute(input: unknown, context: CapabilityContext): Promise<unknown>
}
```

例如：

```ts
defineCapability({
  name: 'checkScenario',
  description: '检查指定场景是否已经开通',

  inputSchema: z.object({
    scenarios: z.array(z.object({
      name: z.string(),
    })),
  }),

  outputSchema: z.array(z.object({
    name: z.string(),
    opened: z.boolean(),
  })),

  async execute(input, context) {
    return await api.checkScenario(input.scenarios)
  },
})
```

业务侧不需要：

```ts
new Agent(...)
```

也不需要维护：

```text
Agent Prompt
Agent Tool
Handoff
Agent Runtime
```

这些由平台负责。

---

## 6. 业务流程

业务侧可以定义自己的 Workflow。

Workflow 不属于编辑器平台的业务逻辑，而只是一个可执行流程定义。

例如：

```ts
defineWorkflow({
  name: 'initialize',

  steps: [
    parseScenario,
    verifyScenario,
    normalizeScenario,
    generateLayout,
  ],
})
```

也可以：

```ts
defineWorkflow({
  name: 'initialize',

  steps: [
    parseProduct,
    generateLayout,
  ],
})
```

平台不能假设所有业务存在：

```text
parse
verify
normalize
```

Workflow 完全由业务侧决定。

---

## 7. Workflow Step

Workflow 中的 Step 是平台执行流程的基本单元。

```ts
interface WorkflowStep {
  name: string

  execute(
    context: WorkflowContext
  ): Promise<StepResult>
}
```

Step 可以内部使用：

```text
普通代码
API
Capability
Agent
```

例如：

```text
Workflow
   │
   ├── Step A
   │      └── API
   │
   ├── Step B
   │      └── Agent
   │
   ├── Step C
   │      └── Capability
   │
   └── Step D
          └── Function
```

因此 Workflow 不等于 Agent。

---

## 8. Workflow Runtime

编辑器平台提供通用 Workflow Runtime，但不提供任何具体业务流程。

Runtime 只负责执行业务侧传入的 Workflow。

```text
Workflow Definition
        ↓
Workflow Runtime
        ↓
Step 1
        ↓
Step 2
        ↓
Step 3
        ↓
...
```

Runtime 负责基础执行能力：

* Step 顺序执行
* 上下文传递
* Step 输入输出
* 异常处理
* 中断
* 恢复
* 日志
* 执行状态
* 必要的重试机制

但 Runtime 不知道：

```text
什么叫场景
什么叫商户
什么叫核查
什么叫标准化
```

---

## 9. Flow Agent

Flow Agent 是编辑器提供的顶层 Agent。

它只负责判断用户输入应该进入哪一种执行模式：

```text
initialize
edit
capability
```

它不负责执行业务流程内部步骤。

例如：

```text
用户：
“创建一个包含盒马鲜生和大润发小时达的页面”

Flow Agent：
→ initialize
```

然后：

```text
initialize
  ↓
Business Workflow
```

再例如：

```text
用户：
“删除这个卡片”

Flow Agent：
→ edit
```

进入：

```text
Edit Agent
```

再例如：

```text
用户：
“检查一下盒马鲜生有没有开通”

Flow Agent：
→ capability
```

进入：

```text
Capability Agent
```

---

## 10. Edit Agent

Edit Agent 是编辑器提供的固定 Agent。

它负责当前页面内容的增删改查。

核心输入：

```text
用户输入
+
当前编辑器状态
+
可用业务能力
```

输出：

```text
Edit IR
```

必要时调用业务 Capability。

例如：

```text
用户：
“把大润发小时达加到优惠区域下面”

        ↓

Edit Agent

        ↓

queryScenario("大润发小时达")

        ↓

获得业务数据

        ↓

生成 Add IR
```

Edit Agent 不要求业务侧提供固定的编辑流程。

---

## 11. Capability Agent

Capability Agent 用于开放式业务能力调用。

输入：

```text
用户输入
+
Capability Registry
+
当前上下文
```

模型负责：

```text
选择能力
+
构造参数
```

平台负责：

```text
执行 Capability
```

例如：

```text
用户：
“帮我检查一下现在配置的所有场景”

        ↓

Capability Agent

        ↓

checkScenario

        ↓

业务接口

        ↓

检查结果
```

---

## 12. Agent 与 Capability 的关系

平台内部可以将 Capability 包装为 Agent Tool。

但这是平台实现细节。

逻辑关系是：

```text
业务侧：

Capability
     │
     ▼
平台 Registry
     │
     ▼
Agent Tool Adapter
     │
     ▼
Agent
```

而不是要求业务侧自己维护：

```text
Business Agent
    ↓
Tool
    ↓
API
```

这样可以避免业务接入者直接进入 Agent 编排领域。

---

## 13. 完整运行过程

### 初始化

```text
User Input
    ↓
Flow Agent
    ↓
initialize
    ↓
Business Workflow
    ↓
Step 1
    ↓
Step 2
    ↓
Step 3
    ↓
Layout Agent / Layout IR
    ↓
Editor
```

### 编辑

```text
User Input
    ↓
Flow Agent
    ↓
edit
    ↓
Edit Agent
    │
    ├── Business Capability
    │
    ├── Business Capability
    │
    └── ...
    ↓
Edit IR
    ↓
Editor
```

### 零散业务操作

```text
User Input
    ↓
Flow Agent
    ↓
capability
    ↓
Capability Agent
    ↓
Business Capability
    ↓
Result
```

---

## 14. 核心职责边界

| 能力                 | 编辑器平台   | 业务侧      |
| ------------------ | ------- | -------- |
| Flow Agent         | 提供      | 不负责      |
| Edit Agent         | 提供      | 不负责      |
| Capability Runtime | 提供      | 使用       |
| Capability 定义      | 提供协议    | 实现       |
| Workflow Runtime   | 提供      | 使用       |
| Workflow 定义        | 不负责     | 定义       |
| 业务流程顺序             | 不负责     | 定义       |
| 业务解析               | 不负责     | 可选       |
| 业务核查               | 不负责     | 可选       |
| 业务标准化              | 不负责     | 可选       |
| Layout IR          | 定义/执行能力 | 提供业务数据   |
| Edit IR            | 定义/执行能力 | 提供必要业务能力 |

---

## 15. 设计原则

### 原则一：不预设业务流程

平台不能假设业务一定存在：

```text
解析 → 核查 → 标准化
```

每个业务项目可以拥有完全不同的 Workflow。

### 原则二：业务能力与 Agent 解耦

业务侧提供 Capability，而不是 Agent。

Agent 只是 Capability 的一种实现或调用方式。

### 原则三：流程控制与模型决策分离

确定性的流程：

```text
代码 / Workflow Runtime
```

开放式决策：

```text
Agent / LLM
```

不要让模型负责已经确定的流程顺序。

### 原则四：编辑器不理解业务

编辑器只理解：

```text
Workflow
Step
Capability
Agent
IR
```

不理解：

```text
场景
商户
卡券
核查
标准化
```

### 原则五：业务接入者不需要理解 Agent

业务侧主要面对：

```text
defineCapability()
defineWorkflow()
```

而不是：

```text
Agent
Prompt
Tool
Handoff
Context
```

---

## 16. 最终模型

整个系统可以抽象为：

```text
                  ┌──────────────┐
                  │  用户输入     │
                  └──────┬───────┘
                         ↓
                  ┌──────────────┐
                  │  Flow Agent  │
                  └──────┬───────┘
                         │
            ┌────────────┼────────────┐
            ↓            ↓            ↓
       Initialize       Edit      Capability
            ↓            ↓            ↓
     Business        Edit Agent   Capability
     Workflow             │          Agent
            │             │            │
            ↓             ├────────────┤
       Workflow           ↓
       Runtime         Business
            │          Capability
            ↓             │
     Business Steps       │
            │             │
            └─────────────┴─────────────┐
                                        ↓
                              Editor / Business Result
```

最终边界可以浓缩成一句话：

> **业务侧决定“自己的流程是什么、有哪些业务能力”；编辑器决定“用户输入如何进入流程、如何编辑页面以及如何执行 IR”；模型只在需要语义判断的地方参与决策。**
