import type { AgentInputItem } from '@openai/agents'
import type { PrepareInitializationResult } from './initialization'
import type {
  AgentDebugConfig,
  AgentHostApi,
  EditorAgentContext,
} from './types'
import { initializeEditorContext } from './initialization.ts'

export interface DebugInitializationStart {
  callId: string
  items: AgentInputItem[]
  result: PrepareInitializationResult
}

/**
 * Build a historical function-call pair for debug startup. The model sees the
 * manually supplied prepare_initialization input and its host result, but does
 * not need to author or re-run that step.
 */
export async function createDebugInitializationStart(
  debug: AgentDebugConfig,
  context: EditorAgentContext,
  api: AgentHostApi = {},
): Promise<DebugInitializationStart> {
  const result = await initializeEditorContext(
    debug.prepareInitialization,
    context,
    api,
  )
  const callId = globalThis.crypto?.randomUUID?.()
    ?? `debug-prepare-${Date.now()}`
  const items: AgentInputItem[] = [
    {
      type: 'function_call',
      callId,
      name: 'prepare_initialization',
      arguments: JSON.stringify(debug.prepareInitialization),
      status: 'completed',
    },
    {
      type: 'function_call_result',
      callId,
      name: 'prepare_initialization',
      status: 'completed',
      output: JSON.stringify(result),
    },
  ]

  return { callId, items, result }
}

export function buildDebugPrompt() {
  return [
    '【调试模式：从 prepare_initialization 开始】',
    '宿主已使用手动 mock 入参执行 prepare_initialization，当前 Run Context 已包含 IR 和 locations。',
    '不要调用 get_current_editor、get_widgets 或 prepare_initialization，也不要解析用户消息。',
    '直接从工具结果中的 IR 继续资源查询，并按 IR components 顺序执行组件操作。',
  ].join('\n')
}
