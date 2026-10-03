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
