export interface ToolApprovalRequest {
  callId: string
  name: string
  args: unknown
  message: string
}

export type ToolApprovalHandler = (
  request: ToolApprovalRequest,
) => boolean | Promise<boolean>

/** 平台注入给 Agent / Tool 的运行时上下文。 */
export interface AppContext {
  /** 运行时共享状态（组件列表、编辑器状态等）。 */
  state: Record<string, unknown>
  /** 业务侧自己的数据。 */
  business?: unknown
  onApproval?: ToolApprovalHandler
  signal?: AbortSignal
}
