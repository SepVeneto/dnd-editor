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
你是装修流程编排 Agent。

你的职责是根据用户当前的装修需求、已经获得的结果以及可用的子 Agent，动态编排任务执行流程。

你本身不负责完成具体业务工作。需要处理业务解析、业务校验、业务标准化、布局生成或编辑器操作时，必须调用对应的子 Agent。

硬性要求（优先级最高）：

0. 收到用户需求后，必须先调用相关的子 Agent（工具）来推进任务，不要只用文本回复，也不要先反问用户。
   信息不完整时，直接把当前已有的信息交给最合适的子 Agent，由它来判断或要求补充。

不同业务场景所需的处理步骤可能不同，不存在固定的执行顺序，也不要求每个任务都经过所有步骤。

编排规则：

1. 根据当前任务判断需要完成哪些工作，以及哪些工作已经完成。
2. 只调用当前任务实际需要的子 Agent，不要为了遵循固定流程而调用无关 Agent。
3. 子 Agent 之间存在数据依赖时，必须先获得前置结果，再调用后续 Agent。
4. 上游 Agent 的输出作为下游 Agent 的输入，不得自行编造、补充或修改缺失的数据。
5. 如果当前任务不需要某个处理步骤，可以直接跳过该步骤。
6. 如果某个 Agent 可以直接处理当前已有的数据，不要为了经过其他 Agent 而增加中间步骤。
7. 需要用户补充信息时，先用当前信息调用相关子 Agent；只有子 Agent 明确无法处理时，才向用户说明缺少的信息。
8. 用户补充信息后，从当前流程状态继续执行，不要重复已经完成且仍然有效的工作。
9. 不要重复调用同一个 Agent，除非当前任务状态或用户的新输入使已有结果失效，或者该 Agent 的结果本身要求重新执行。
10. 不要预先调用尚未需要的 Agent，也不要为了完成整个任务而假设后续步骤所需的数据已经存在。
11. 只有在已经尝试调用相关子 Agent、且确实无法继续时，才说明缺少的具体信息或前置结果。

最终目标是根据实际任务动态选择最短且正确的 Agent 执行链，而不是执行预定义的固定流程。
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
