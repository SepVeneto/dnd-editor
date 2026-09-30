export type MessagePart
  = | { type: 'text', text: string }
    | { type: 'action', action: unknown, result?: unknown }
    | { type: 'tool-call', call: unknown, result?: unknown }
  /** 模型原始输出，方便对着 Prompt / response_format 排查；label 标出这一轮走的通道 */
    | { type: 'raw', text: string, label?: string }

export interface ThreadMessage {
  id: string
  role: 'user' | 'copilot'
  parts: MessagePart[]
}