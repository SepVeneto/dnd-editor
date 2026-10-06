import { z } from 'zod'
import { Agent } from './Agent'
import type { Capability } from './capability'
import type { Workflow } from './workflow'

export type FlowType = 'initialize' | 'edit' | 'capability'

export interface FlowClassification {
  flow: FlowType
  /** 传递给下一步的、可能被整理后的输入。 */
  input?: string
  /** 补充说明（可选）。 */
  note?: string
}

const FLOW_INSTRUCTIONS = `
你是顶层流程路由 Agent（Flow Agent）。

你的唯一职责是判断用户输入应该进入哪一种执行模式：
- initialize：用户希望根据输入初始化 / 生成一个页面。进入业务侧定义的 Workflow。
- edit：用户希望修改当前编辑器里的页面内容。进入编辑器提供的 Edit Agent。
- capability：用户输入不属于初始化或编辑，而是需要直接执行某个业务能力。

不要执行具体业务流程，不要调用工具，不要编造数据，只输出分类结果。
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
    handoffDescription: '判断用户输入应进入初始化、编辑还是能力调用。',
    instructions: `${FLOW_INSTRUCTIONS}\n\n${context}`,
    outputType: z.object({
      flow: z.enum(['initialize', 'edit', 'capability']),
      input: z.string().optional(),
      note: z.string().optional(),
    }),
  })
}
