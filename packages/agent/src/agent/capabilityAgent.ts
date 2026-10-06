import { Agent } from './Agent'
import { createCapabilityTool } from './capability'
import type { Capability } from './capability'

const CAPABILITY_INSTRUCTIONS = `
你是业务能力调用 Agent，用于开放式业务能力调用。

输入：
- 用户输入
- 可用业务能力列表
- 当前上下文

你的职责是：
1. 判断用户输入需要调用哪个业务能力（或哪几个能力）。
2. 根据能力描述构造调用参数。
3. 只调用与用户输入直接相关的能力，不要调用无关能力。
4. 如果没有任何能力能匹配用户输入，明确说明无法处理。

你负责选择和构造参数，具体执行由平台完成。
`

export function createCapabilityAgent(options: { capabilities: Capability<any, any>[] }): Agent {
  return new Agent({
    name: 'capability',
    handoffDescription: '开放式业务能力调用：选择业务能力并构造参数。',
    instructions: CAPABILITY_INSTRUCTIONS,
    tools: options.capabilities.map(createCapabilityTool),
  })
}
