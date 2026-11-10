export type ChatMode = 'data' | 'text'
export type MessageRole = 'system' | 'user' | 'assistant'
export type AgentApiMode = 'responses' | 'chat_completions'
export type AgentFileKind = 'document' | 'image'

export interface AgentModelConfig {
  /** OpenAI-compatible endpoint exposed by the host or its BFF. */
  baseURL?: string
  model?: string
  apiMode?: AgentApiMode
}

export interface AgentEditorOperation {
  action: 'add' | 'edit' | 'delete' | 'move'
  /** Existing node UUID used by edit, delete, and move operations. */
  target?: string
  /** Widget type id used by `add`. */
  widget?: string
  /**
   * Editor data assembled by a host tool and injected by the host.
   * This field is intentionally absent from the model-facing tool schema.
   */
  items?: unknown[]
  changes?: Record<string, unknown>
  style?: Record<string, unknown>
  before?: string
  after?: string
}

/** Mutable state scoped to one Agent Run. */
export type EditorAgentContext = Record<string, unknown>

/**
 * APIs implemented by the host. The agent runtime only knows this contract, so
 * the editor document and business data never become part of the agent package.
 */
export interface AgentEditorApi {
  getCurrentEditor: () => unknown | Promise<unknown>
  getWidgets: () => unknown | Promise<unknown>
  /** Stable widget capability catalog used for component and DSL validation. */
  getCapabilities?: () => unknown | Promise<unknown>
  getRevision?: () => number | Promise<number>
  validateDsl: (
    dsl: unknown,
    context?: EditorAgentContext,
  ) => unknown | Promise<unknown>
  /** Direct add operation without DSL parameter validation. */
  addNode?: (
    operation: Record<string, unknown>,
    context?: EditorAgentContext,
  ) => unknown | Promise<unknown>
  applyDsl: (
    dsl: unknown,
    context?: EditorAgentContext,
  ) => unknown | Promise<unknown>
  undo?: (
    revision?: number,
  ) => unknown | Promise<unknown>
  /** Context contains business data prepared by tools during the current Agent Run. */
  operateEditor: (
    operation: AgentEditorOperation,
    context?: EditorAgentContext,
  ) => unknown | Promise<unknown>
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
  /** Server-side upload id used to retrieve the file content. */
  name: string
  /** Original file name shown to the user. */
  file: string
  /** Missing on legacy stored document parts. */
  kind?: AgentFileKind
  mimeType?: string
  size?: number
  /** Converted document content sent to the agent as context. */
  text?: string
  /** BFF URL used to render an image preview without persisting Base64 data. */
  url?: string
}

export type MessagePart = TextPart | ReasoningPart | ToolPart | DataPart | FilePart

export interface ChatMessage {
  id: string
  role: MessageRole
  parts: MessagePart[]
}
