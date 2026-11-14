import { Agent, handoff } from '@openai/agents'
import { buildMainAgentInstructions, MAIN_AGENT_NAME } from './agentInstructions.ts'

export const DEFAULT_AGENT_MODEL = 'qwen3.6-flash'
export const DEFAULT_AGENT_BFF_URL = 'http://localhost:4000/v1'
const RETURN_TO_MAIN_TOOL_NAME = 'transfer_back_to_main'

/** A host-created OpenAI Agents SDK Agent. */
export type AgentSubAgent = Agent<any, any>

export interface CreateAgentsOptions {
  model?: string
  subAgents?: AgentSubAgent[]
}

function subAgentInfo(value: Agent<any, any>) {
  return {
    name: value.name,
    description: value.handoffDescription,
  }
}

function assertUniqueSubAgents(subAgents: Agent<any, any>[]) {
  const names = new Set<string>()

  for (const subAgent of subAgents) {
    if (subAgent.name === MAIN_AGENT_NAME || names.has(subAgent.name))
      throw new Error(`子 Agent 名称重复或与主 Agent 冲突：${subAgent.name}`)
    names.add(subAgent.name)
  }
}

/**
 * Build the runtime topology. The main agent is always a dispatcher with no
 * function tools; only host-provided sub-agents can perform work.
 */
export function createAgents(options: CreateAgentsOptions) {
  const model = options.model || DEFAULT_AGENT_MODEL
  const modelSettings = {
    temperature: 0,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    reasoning: { effort: 'none' as const },
    text: { verbosity: 'low' as const },
  }
  const subAgents = options.subAgents ?? []
  assertUniqueSubAgents(subAgents)

  const agent = new Agent({
    name: MAIN_AGENT_NAME,
    handoffDescription: '只负责请求分诊和调度宿主提供的子 Agent。',
    model,
    modelSettings,
    instructions: buildMainAgentInstructions({
      subAgents: subAgents.map(subAgentInfo),
    }),
    tools: [],
  })

  const runnableSubAgents = subAgents.map(subAgent => subAgent.clone({
    handoffs: [
      ...subAgent.handoffs,
      handoff(agent, {
        toolNameOverride: RETURN_TO_MAIN_TOOL_NAME,
        toolDescriptionOverride: '当前子 Agent 已完成全部任务且无需用户补充信息时调用，将控制权交还主 Agent，由主 Agent 统一回复。',
      }),
    ],
  }))

  agent.handoffs = runnableSubAgents

  return {
    agent,
    subAgents: runnableSubAgents,
    agents: [agent, ...runnableSubAgents],
  }
}
