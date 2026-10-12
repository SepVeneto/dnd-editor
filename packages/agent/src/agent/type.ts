export type MessagePart
  = | { type: 'text', text: string }
    | { type: 'action', action: unknown, result?: unknown }
    | { type: 'tool-call', call: unknown, result?: unknown }
  /** 运行时的一个步骤标题（第几轮、阶段名） */
    | { type: 'step', label: string }
  /** 流程里的一个可折叠步骤，展开后是该步骤的输出 */
    | { type: 'workflow-step', label: string, status: 'running' | 'done' | 'error', output?: unknown, error?: string }
  /** 需要人工确认的工具：展示审批请求与用户决策 */
    | { type: 'approval', call: unknown, decision?: 'approved' | 'rejected' }
  /** 模型原始输出，方便对着 Prompt / response_format 排查；label 标出这一轮走的通道 */
    | { type: 'raw', text: string, label?: string }

export interface ThreadMessage {
  id: string
  role: 'user' | 'copilot'
  parts: MessagePart[]
  /** 助手回复的耗时（毫秒），用于「正在思考」折叠块在结束后展示「用时」。 */
  duration?: number
}
