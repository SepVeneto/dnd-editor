export type ChatMode = 'data' | 'text'
export type MessageRole = 'system' | 'user' | 'assistant'
export type AgentApiMode = 'responses' | 'chat_completions'

export interface AgentModelConfig {
  /** OpenAI-compatible endpoint exposed by the host or its BFF. */
  baseURL?: string
  model?: string
  apiMode?: AgentApiMode
}

export interface AgentEditorOperation {
  action: 'add' | 'edit' | 'delete' | 'move'
  /** Existing node UUID. For `add`, this is the optional parent UUID. */
  target?: string
  /** Widget type id used by `add`. */
  widget?: string
  items?: unknown[]
  changes?: Record<string, unknown>
  style?: Record<string, unknown>
  before?: string
  after?: string
}

/**
 * APIs implemented by the host. The agent runtime only knows this contract, so
 * the editor document and business data never become part of the agent package.
 */
export interface AgentEditorApi {
  getCurrentEditor: () => unknown | Promise<unknown>
  getWidgets: () => unknown | Promise<unknown>
  operateEditor: (operation: AgentEditorOperation) => unknown | Promise<unknown>
}

export interface AgentHostApi {
  model?: AgentModelConfig
  editor?: Partial<AgentEditorApi>
}

export interface TextPart {
  type: 'text'
  text: string
}

export interface ReasoningPart {
  type: 'reasoning'
  text: string
}

export interface ToolPart {
  type: 'tool'
  toolCallId: string
  toolName: string
  state: 'input-available' | 'output-available'
  input?: unknown
  output?: unknown
  errorText?: string
}

export interface DataPart {
  type: 'data'
  name: string
  data?: unknown
}

export type MessagePart = TextPart | ReasoningPart | ToolPart | DataPart

export interface ChatMessage {
  id: string
  role: MessageRole
  parts: MessagePart[]
}
