import type { VueElementConstructor } from 'vue'
import { defineCustomElement } from 'vue'
import Copilot from './agent/Copilot.vue'

export const MpdAgent = Copilot

/**
 * Build the `<dnd-agent>` custom element from the same Vue runtime that is
 * bundled into this package.
 */
export function createAgentElement(): VueElementConstructor {
  return defineCustomElement(MpdAgent)
}

export type {
  AgentApiMode,
  AgentEditorApi,
  AgentEditorOperation,
  AgentHostApi,
  AgentModelConfig,
  ChatMessage,
  ChatMode,
  DataPart,
  MessagePart,
  MessageRole,
  ReasoningPart,
  TextPart,
  ToolPart,
} from './types'

export type {
  AgentToolApprovalOptions,
  AgentToolContext,
  AgentToolDefinition,
} from './tool'
export {
  defineAgentTool,
  defineCapability,
} from './tool'

export type {
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeOptions,
  AgentRuntimeTurn,
} from './runtime'
export { createAgentRuntime } from './runtime'

export type { CreateAgentsOptions } from './agents'
export {
  createAgents,
  DEFAULT_AGENT_BFF_URL,
  DEFAULT_AGENT_MODEL,
} from './agents'

export {
  Agent,
  MemorySession,
  run,
  Runner,
  tool,
} from '@openai/agents'
