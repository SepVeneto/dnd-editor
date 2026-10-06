import { Agent } from '@openai/agents'
import { z } from 'zod'
import type { Capability } from './capability'
import { getModel } from './core/sdk'
import type { Workflow } from './workflow'

export type FlowType = 'initialize' | 'edit' | 'capability'

export interface FlowClassification {
  flow: FlowType
  input?: string
  note?: string
}

export const flowOutputSchema = z.object({
  flow: z.enum(['initialize', 'edit', 'capability']),
})

const FLOW_INSTRUCTIONS = `
你是顶层流程路由 Agent（Flow Agent）。

你的唯一职责是判断用户输入应该进入哪一种执行模式：
- initialize：用户希望根据输入初始化 / 生成一个页面。输入可能是业务配置、业务数据或文档，进入业务侧 Workflow。
- edit：用户希望修改当前编辑器里已有的页面内容。进入编辑器提供的 Edit Agent。
- capability：用户输入是独立业务操作（例如查询、检查等），不涉及生成或修改页面。

结合下方“可用业务流程”和“可用业务能力”的描述来判断，不要执行具体业务流程，不要调用工具，不要编造数据。

只输出一个 JSON 对象，不要输出任何其它文字：
{ "flow": "initialize" | "edit" | "capability" }
`

export function createFlowAgent(options: {
  workflows: Workflow[]
  capabilities: Capability<any, any>[]
}): Agent<any, any> {
  const workflowDescriptions = options.workflows
    .map(workflow => `- ${workflow.name}：${workflow.description ?? '无描述'}`)
    .join('\n')
  const capabilityDescriptions = options.capabilities
    .map(capability => `- ${capability.name}：${capability.description}`)
    .join('\n')

  const context = [
    '当前可用业务流程：',
    workflowDescriptions || '（无）',
    '',
    '当前可用业务能力：',
    capabilityDescriptions || '（无）',
  ].join('\n')

  return new Agent({
    name: 'flow',
    model: getModel(),
    handoffDescription: '判断用户输入应进入初始化、编辑还是能力调用。',
    instructions: `${FLOW_INSTRUCTIONS}\n\n${context}`,
  })
}
