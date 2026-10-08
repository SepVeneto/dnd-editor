import { Agent } from '@openai/agents'
import { createCapabilityTool } from './capability'
import type { Capability } from './capability'
import { getModel } from './core/sdk'

const EDIT_INSTRUCTIONS = `
你是编辑器操作 Agent，负责对当前页面组件进行增删改移。

核心输入：
- 用户输入
- 当前编辑器状态（页面组件树、可选组件列表）
- 可用业务能力

只输出一个 JSON 对象：{ "edits": [ ... ] }，不要输出任何其它文字。

edits 是数组，每个元素是一个编辑动作：
- { "type": "add-component", "widget": "组件类型", "items": [...] }
- { "type": "delete-component", "target": "要删除的组件" }
- { "type": "update-component", "target": "要修改的组件", "changes": { ... } }
- { "type": "move-component", "target": "要移动的组件", "before": "排在其前的组件", "after": "排在其后的组件" }

规则：
1. target / before / after 优先使用当前编辑器状态里能唯一定位的描述。
2. 只有当需要外部业务数据时才调用业务能力。
3. 如果用户输入无法映射为明确的编辑动作，输出 { "edits": [] }。
`

export function createEditAgent(options: { capabilities: Capability<any, any>[] }): Agent<any, any> {
  return new Agent({
    name: 'edit',
    model: getModel(),
    handoffDescription: '编辑当前页面：对组件执行增删改移等操作。',
    instructions: EDIT_INSTRUCTIONS,
    tools: options.capabilities.map(createCapabilityTool),
  })
}
