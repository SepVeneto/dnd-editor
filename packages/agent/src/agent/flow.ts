import { Agent, layoutAgent, normalizeLayoutInputAgent } from './Agent'
import { getRegisteredAgentTools, registerAgent } from './registry'

/**
 * 装修流程编排。
 *
 * 子 Agent 在模块加载时通过 `registerAgent` 注册成 tool，
 * 流程 Agent 构建时再从注册表里统一取用；
 * 工具之间需要传递的中间结果放在模块级的共享 state 里，由内部管理。
 */
export interface DecorationFlowState {
  /** 标准化子 Agent 的产出，供布局子 Agent 兜底使用 */
  elements?: unknown
  /** 布局子 Agent 的产出，宿主拿它去执行 / 渲染 */
  layout?: unknown
  /** 宿主侧可用组件，调用布局子 Agent 时注入 */
  widgets?: any[]
}

export interface DecorationFlow {
  agent: Agent<any, any>
  state: DecorationFlowState
  /** 每次运行前清空上一次的中间结果 */
  reset: () => void
}

const INSTRUCTIONS = `
你是装修流程的编排 Agent。

输入是用户的一段装修需求。你只能通过调用子 Agent（工具）来推进任务，
不要自己直接产出结构化配置或布局，也不要编造数据。

可用的子 Agent 以工具形式提供，具体能力见每个工具的说明，一般包括：
- 解析用户提供的业务配置 / 文档
- 校验配置、查询并开通相关场景
- 把业务元素标准化成 { kind, items }
- 根据标准化元素和可用组件生成布局 IR

按需选择一个或多个子 Agent 调用，并把上游的输出作为下游的输入；
用户没有提供某一步所需的数据时，跳过该步骤，不要编造数据。
`

/** 工具之间传递的中间结果，由内部管理 */
const state: DecorationFlowState = {}

function reset() {
  state.elements = undefined
  state.layout = undefined
}

registerAgent(normalizeLayoutInputAgent, {
  toolName: 'normalize_layout_input',
  toolDescription: '把业务元素标准化成 { kind, items } 结构。',
  extractOutput: (result) => {
    try {
      state.elements = JSON.parse(result.text)
    }
    catch {
      // 结果不是 JSON 时保留内部缓存
    }
    return result.text
  },
})

registerAgent(layoutAgent, {
  toolName: 'generate_layout',
  toolDescription: '根据标准化元素和可用组件生成布局 IR。',
  buildInput: (input) => {
    let elements = state.elements
    try {
      const parsed = JSON.parse(input)
      elements = Array.isArray(parsed) ? parsed : parsed?.elements ?? elements
    }
    catch {
      // 模型可能传了自然语言，回退到内部缓存的标准化结果
    }
    return JSON.stringify({ elements, widgets: state.widgets ?? [] })
  },
  extractOutput: (result) => {
    try {
      state.layout = JSON.parse(result.text)
    }
    catch {
      state.layout = result.text
    }
    return result.text
  },
})

export function createDecorationFlowAgent(): DecorationFlow {
  const agent = new Agent({
    name: 'decoration flow',
    handoffDescription: '装修流程总控：按用户需求调用子 Agent 完成标准化与布局。',
    instructions: INSTRUCTIONS,
    tools: getRegisteredAgentTools(),
  })

  return { agent, state, reset }
}
