import type { FunctionTool, RunContext } from '@openai/agents'
import type { AgentHostTool, AgentToolDefinition } from './tool'
import type { AgentHostApi, EditorAgentContext } from './types'
import { Agent, handoff, tool } from '@openai/agents'
import { z } from 'zod'
import {
  buildMainAgentInstructions,
  MAIN_AGENT_NAME,
  RETURN_TO_MAIN_AGENT_TOOL_NAME,
} from './agentInstructions.ts'
import { createEditorDslTools } from './editorDsl.ts'
import { isAgentSdkTool } from './tool.ts'

export const DEFAULT_AGENT_MODEL = 'qwen3.6-flash'
export const DEFAULT_AGENT_BFF_URL = 'http://localhost:4000/v1'

/**
 * Host-owned specialist agent definition. The runtime only attaches handoffs;
 * the host owns the role, instructions and tools.
 */
export interface AgentSubAgentDefinition {
  name: string
  instructions: string
  handoffDescription: string
  tools?: AgentHostTool[]
  /**
   * Inject the public editor DSL tools. Defaults to true for host agents that
   * edit the document and should be disabled for read-only specialists.
   */
  editorDsl?: boolean
  handoffToolName?: string
  handoffToolDescription?: string
  returnToMain?: boolean
  returnToolName?: string
  returnToolDescription?: string
}

/** A host-provided sub-agent or the definition used to construct one. */
export type AgentSubAgent = Agent<any, any> | AgentSubAgentDefinition

export interface CreateAgentsOptions {
  model?: string
  api?: AgentHostApi
  subAgents?: AgentSubAgent[]
}

async function resolveApproval(
  definition: AgentToolDefinition,
  input: unknown,
) {
  const needsApproval = typeof definition.needsApproval === 'function'
    ? await definition.needsApproval(input)
    : definition.needsApproval

  if (!needsApproval)
    return true

  if (typeof window === 'undefined' || typeof window.confirm !== 'function')
    return false

  // eslint-disable-next-line no-alert
  return window.confirm(
    definition.approval?.message?.(input)
    ?? `是否执行工具 ${definition.name}？`,
  )
}

function adaptHostTool(
  definition: AgentToolDefinition,
  api: AgentHostApi,
): FunctionTool<any, any, any> {
  const zodParameters = definition.parameters
    ?? definition.inputSchema
    ?? z.object({ input: z.string().optional() })
  const { $schema: _schema, ...jsonParameters } = z.toJSONSchema(
    zodParameters,
    { io: 'input' },
  )

  return tool({
    name: definition.name,
    description: definition.description,
    parameters: jsonParameters,
    // Host tools may legitimately use optional fields. Non-strict mode accepts
    // their JSON schema without requiring every property to be nullable.
    strict: false,
    async execute(
      input: unknown,
      runContext?: RunContext<EditorAgentContext>,
    ) {
      const context = runContext?.context
      if (!context)
        throw new Error('缺少当前 Agent Run 的 Context')

      if (!await resolveApproval(definition, input)) {
        return {
          ok: false,
          rejected: true,
          message: `用户不同意执行 ${definition.name}`,
        }
      }

      try {
        return await definition.execute(input, {
          api,
          context,
        })
      }
      catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  } as any)
}

function isAgent(value: AgentSubAgent): value is Agent<any, any> {
  return value instanceof Agent || (
    typeof value === 'object'
    && 'handoffs' in value
    && Array.isArray(value.handoffs)
    && 'tools' in value
    && Array.isArray(value.tools)
    && 'instructions' in value
  )
}

function subAgentInfo(value: AgentSubAgent) {
  return {
    name: value.name,
    description: value.handoffDescription,
  }
}

function assertUniqueSubAgents(subAgents: AgentSubAgent[]) {
  const names = new Set<string>()
  const handoffToolNames = new Set<string>()

  for (const subAgent of subAgents) {
    if (subAgent.name === MAIN_AGENT_NAME || names.has(subAgent.name))
      throw new Error(`子 Agent 名称重复或与主 Agent 冲突：${subAgent.name}`)
    names.add(subAgent.name)

    if (isAgent(subAgent))
      continue

    const toolName = subAgent.handoffToolName
    if (toolName && handoffToolNames.has(toolName))
      throw new Error(`子 Agent handoff 工具名重复：${toolName}`)
    if (toolName)
      handoffToolNames.add(toolName)
  }
}

/**
 * Build the runtime topology. The main agent is always a dispatcher with no
 * function tools; only host-provided sub-agents can perform work.
 */
export function createAgents(options: CreateAgentsOptions) {
  const model = options.model || DEFAULT_AGENT_MODEL
  const modelSettings = {
    reasoning: { effort: 'none' as const },
    text: { verbosity: 'low' as const },
  }
  const api = options.api ?? {}
  const definitions = options.subAgents ?? []
  assertUniqueSubAgents(definitions)

  const subAgents: Agent<any, any>[] = definitions.map((definition) => {
    if (isAgent(definition))
      return definition

    const tools = [
      ...(definition.editorDsl === false
        ? []
        : createEditorDslTools(api)),
      ...(definition.tools ?? []).map(item =>
        isAgentSdkTool(item)
          ? item
          : adaptHostTool(item, api),
      ),
    ]
    return new Agent({
      name: definition.name,
      handoffDescription: definition.handoffDescription,
      model,
      modelSettings,
      instructions: definition.instructions,
      tools,
    })
  })

  const agent = new Agent({
    name: MAIN_AGENT_NAME,
    handoffDescription: '只负责请求分诊和调度宿主提供的子 Agent。',
    model,
    modelSettings,
    instructions: buildMainAgentInstructions({
      subAgents: definitions.map(subAgentInfo),
    }),
    tools: [],
  })

  definitions.forEach((definition, index) => {
    if (isAgent(definition))
      return

    const subAgent = subAgents[index]
    if (definition.returnToMain !== false) {
      subAgent.handoffs = [
        handoff(agent, {
          toolNameOverride: definition.returnToolName
            ?? RETURN_TO_MAIN_AGENT_TOOL_NAME,
          toolDescriptionOverride: definition.returnToolDescription
            ?? `专业任务完成、取消，或无需继续处理时，将控制权交还 ${MAIN_AGENT_NAME}。`,
        }),
      ]
    }
  })

  agent.handoffs = definitions.map((definition, index) => {
    const subAgent = subAgents[index]
    if (isAgent(definition))
      return handoff(subAgent)
    return handoff(subAgent, {
      toolNameOverride: definition.handoffToolName,
      toolDescriptionOverride: definition.handoffToolDescription
        ?? definition.handoffDescription,
    })
  })

  return {
    agent,
    subAgents,
    agents: [agent, ...subAgents],
  }
}
