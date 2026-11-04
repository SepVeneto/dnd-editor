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
  /**
   * Editor data assembled by a business tool and injected by the host.
   * This field is intentionally absent from the model-facing tool schema.
   */
  items?: unknown[]
  changes?: Record<string, unknown>
  style?: Record<string, unknown>
  before?: string
  after?: string
}

/**
 * Mutable state scoped to one Agent Run.
 *
 * Business tools write complete editor data into `pendingItems`; the editor
 * tool consumes it after a successful operation. A fresh object is created for
 * every turn so concurrent runs and conversations never share business data.
 */
export interface EditorAgentContext extends Record<string, unknown> {
  pendingItems: unknown[]
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

export interface FilePart {
  type: 'file'
  /** Server-side upload id used to retrieve the converted document. */
  name: string
  /** Original file name shown to the user. */
  file: string
  size?: number
  /** Converted document content sent to the agent as context. */
  text?: string
}

export type MessagePart = TextPart | ReasoningPart | ToolPart | DataPart | FilePart

export interface ChatMessage {
  id: string
  role: MessageRole
  parts: MessagePart[]
}
