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

export type { CreateAgentsOptions } from './agents'

export {
  createAgents,
  DEFAULT_AGENT_BFF_URL,
  DEFAULT_AGENT_MODEL,
} from './agents'
export type {
  PreparedEditorOperation,
} from './editorContext'

export {
  completeEditorOperation,
  createEditorAgentContext,
  editorOperationSucceeded,
  prepareEditorOperation,
} from './editorContext'

export type {
  AgentInitializationMode,
  AgentInitializationRequest,
  AgentInitializationResult,
  AgentInitializationTool,
} from './initialization'
export {
  defineInitializationTool,
  findInitializationTool,
  INITIALIZATION_TOOL_ROLE,
} from './initialization'

export type {
  AgentRuntime,
  AgentRuntimeConfig,
  AgentRuntimeOptions,
  AgentRuntimeTurn,
} from './runtime'
export { createAgentRuntime } from './runtime'

export type { AgentUploadedFile } from './services'
export { resolveAgentServiceURL } from './services'

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
  AgentApiMode,
  AgentEditorApi,
  AgentEditorOperation,
  AgentHostApi,
  AgentModelConfig,
  ChatMessage,
  ChatMode,
  DataPart,
  EditorAgentContext,
  FilePart,
  MessagePart,
  MessageRole,
  ReasoningPart,
  TextPart,
  ToolPart,
} from './types'

export {
  Agent,
  MemorySession,
  run,
  Runner,
  tool,
} from '@openai/agents'
