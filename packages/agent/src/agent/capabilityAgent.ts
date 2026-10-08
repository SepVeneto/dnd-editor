import { Agent } from '@openai/agents'
import { createCapabilityTool } from './capability'
import type { Capability } from './capability'
import { getModel } from './core/sdk'

const CAPABILITY_INSTRUCTIONS = `
你是业务能力调用 Agent，用于开放式业务能力调用。

输入：用户输入、可用业务能力列表、当前上下文。

用户输入通常对应某个业务能力，你的职责是直接调用最相关的能力，而不是只做文字说明：
1. 优先根据用户输入选择并调用一个业务能力。
2. 根据该能力的描述与入参 schema 构造参数。
3. 除非确实没有任何能力相关，否则必须调用工具获取真实结果。
`

export function createCapabilityAgent(options: { capabilities: Capability<any, any>[] }): Agent<any, any> {
  return new Agent({
    name: 'capability',
    model: getModel(),
    handoffDescription: '开放式业务能力调用：选择业务能力并构造参数。',
    instructions: CAPABILITY_INSTRUCTIONS,
    tools: options.capabilities.map(createCapabilityTool),
  })
}
