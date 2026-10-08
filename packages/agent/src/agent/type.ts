export type MessagePart
  = | { type: 'text', text: string }
    | { type: 'action', action: unknown, result?: unknown }
    | { type: 'tool-call', call: unknown, result?: unknown }
  /** 运行时的一个步骤标题（第几轮、阶段名） */
    | { type: 'step', label: string }
  /** 需要人工确认的工具：展示审批请求与用户决策 */
    | { type: 'approval', call: unknown, decision?: 'approved' | 'rejected' }
  /** 模型原始输出，方便对着 Prompt / response_format 排查；label 标出这一轮走的通道 */
    | { type: 'raw', text: string, label?: string }

export interface ThreadMessage {
  id: string
  role: 'user' | 'copilot'
  parts: MessagePart[]
}
