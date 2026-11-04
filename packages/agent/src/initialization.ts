import type { AgentToolDefinition } from './tool'

export const INITIALIZATION_TOOL_ROLE = 'initialization' as const

/** Lightweight context a host can show while asking how to initialize a page. */
export interface AgentInitializationRequest {
  /**
   * A short summary of the user's checklist or page request. The full document
   * remains in the conversation and is intentionally not duplicated here.
   */
  checklistSummary?: string
}

export type AgentInitializationMode = 'custom' | 'reference' | 'cancelled'

/**
 * Host-owned result of the initialization choice.
 *
 * `custom` lets the model design from the user's checklist. `reference` uses a
 * reference ID explicitly entered by the user. `cancelled` stops initialization
 * and waits for the user.
 */
export interface AgentInitializationResult {
  mode: AgentInitializationMode
  /** Required when mode is `reference`; entered by the user. */
  referenceId?: string
  /** Reference data fetched by the host using `referenceId`. */
  referenceData?: unknown
}

/**
 * Optional host tool invoked whenever the agent enters initialization mode.
 * The host owns the interaction and result shape; the agent only consumes the
 * returned value as context for the initialization.
 */
export type AgentInitializationTool = AgentToolDefinition<
  AgentInitializationRequest,
  unknown
> & {
  role: typeof INITIALIZATION_TOOL_ROLE
}

/**
 * Define the optional host-owned initialization tool.
 */
export function defineInitializationTool(
  definition: Omit<AgentInitializationTool, 'kind' | 'role'>,
): AgentInitializationTool {
  return {
    ...definition,
    kind: 'agent-tool',
    role: INITIALIZATION_TOOL_ROLE,
  }
}

/** Find the optional host-owned initialization tool. */
export function findInitializationTool(
  tools: readonly AgentToolDefinition[] = [],
): AgentToolDefinition | undefined {
  return tools.find(tool => tool.role === INITIALIZATION_TOOL_ROLE)
}

export const INITIALIZATION_AGENT_NAME = 'Initialization Agent'
export const INITIALIZATION_HANDOFF_TOOL_NAME = 'start_initialization'
export const INITIALIZATION_RETURN_TOOL_NAME = 'finish_initialization'

/** Main-agent instructions for deciding when to hand off to the initializer. */
export function buildInitializationInstructions(
  options: {
    toolName?: string
    agentName?: string
  } = {},
): string[] {
  const {
    toolName,
    agentName = INITIALIZATION_AGENT_NAME,
  } = options

  if (!toolName) {
    return [
      '当前宿主未提供初始化工具。进入初始化时，必须在对话中先询问用户：由模型自主设计，还是使用参考数据。不要自行假定初始化方式。',
      '用户选择参考数据时，必须询问用户提供参考数据 ID；收到有效 ID 后调用对应业务工具获取完整参考数据，不得自行选择、编造参考数据，也不得只凭 ID 继续。',
      '用户确认初始化方式后，再继续后续页面创建；业务内容仍须通过业务侧工具准备。',
    ]
  }

  return [
    `判断为初始化后，不要直接调用 ${toolName}，也不要自行执行初始化。必须调用 ${INITIALIZATION_HANDOFF_TOOL_NAME} 暂时移交给 ${agentName}。`,
    `初始化子 Agent 只调用 ${toolName}，该工具会让用户在“由模型自主设计”和“使用参考数据”之间选择，不得跳过该选择或替用户决定。`,
    `初始化结果为 mode=custom 时，按用户的装修清单自主设计页面。`,
    `初始化结果为 mode=reference 时，必须使用工具结果中的 referenceData 作为参考，不得自行从列表选择，也不得编造或替换数据。若工具未返回 referenceData，停止初始化并告知用户参考数据加载失败，不得只凭 referenceId 继续。`,
    `初始化结果为 mode=cancelled 时，停止初始化并等待用户，不要修改页面。`,
    '完成初始化选择后，必须恢复编辑流程：先读取当前编辑器，再查询可用组件，并为每个组件调用业务侧工具准备数据，最后通过 editor_operator 完成页面。参考数据只决定页面结构和组件选择，不能替代业务侧工具返回的数据。',
    '重新获得控制权后，必须根据初始化工具返回结果继续，不得自行假定用户选择，也不要通过其他工具推测或补齐工具未返回的信息。',
    `增量修改不得调用 ${INITIALIZATION_HANDOFF_TOOL_NAME}，也不得移交初始化子 Agent。`,
  ]
}

/** Instructions for the isolated initialization sub-agent. */
export function buildInitializationAgentInstructions(
  toolName: string,
  mainAgentName: string,
): string[] {
  return [
    '你只负责执行页面初始化准备，不负责设计页面，也不直接修改编辑器。',
    `你唯一可调用的业务工具是 ${toolName}。不得调用任何编辑器工具、其他业务工具或自行伪造初始化数据。`,
    `收到移交后必须调用 ${toolName}。该工具负责让用户在自主设计和参考数据之间选择，你不能跳过或替用户回答。`,
    '工具返回 mode=custom、mode=reference 或 mode=cancelled 后立即结束初始化准备。',
    `工具执行成功或失败后，都必须调用 ${INITIALIZATION_RETURN_TOOL_NAME} 将控制权交还 ${mainAgentName}。`,
    '不要向用户输出最终完成答复；把工具结果保留在对话中，由主 Agent 继续后续页面操作。',
  ]
}
