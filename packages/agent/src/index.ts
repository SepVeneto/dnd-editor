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

export {
  MAIN_AGENT_NAME,
} from './agentInstructions'
export type { MainAgentInfo } from './agentInstructions'
export type {
  AgentSubAgent,
  CreateAgentsOptions,
} from './agents'

export {
  createAgents,
  DEFAULT_AGENT_BFF_URL,
  DEFAULT_AGENT_MODEL,
} from './agents'
export type {
  CreateEditorDslToolsOptions,
} from './editorDsl'
export {
  APPLY_EDITOR_DSL_TOOL_NAME,
  createEditorDslTools,
  createEditorTools,
  GET_CURRENT_EDITOR_TOOL_NAME,
  GET_WIDGETS_TOOL_NAME,
  UNDO_EDITOR_DSL_TOOL_NAME,
  VALIDATE_EDITOR_DSL_TOOL_NAME,
} from './editorDsl'
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
  AgentApiMode,
  AgentEditorApi,
  AgentEditorDsl,
  AgentEditorDslValidation,
  AgentFileKind,
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

export type {
  DslAddOperation,
  DslCustomOperation,
  DslDeleteOperation,
  DslDocumentSnapshot,
  DslIssue,
  DslOperation,
  DslPlacement,
  DslScope,
  DslScopeMode,
  DslUpdateOperation,
  DslValidationOptions,
  DslValidationResult,
  EditorDsl,
} from '@sepveneto/dnde-core'
