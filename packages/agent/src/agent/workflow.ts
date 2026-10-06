import type { ToolApprovalHandler } from './Agent'
import type { RunEvent } from './core/run'

export type WorkflowEvent =
  | { type: 'workflow-start', workflow: string }
  | { type: 'step-start', workflow: string, step: string, index: number }
  | { type: 'step-complete', workflow: string, step: string, index: number, output?: unknown }
  | { type: 'step-retry', workflow: string, step: string, index: number, attempt: number, error: string }
  | { type: 'step-error', workflow: string, step: string, index: number, error: string }
  | { type: 'workflow-complete', workflow: string, output?: unknown }
  | { type: 'workflow-abort', workflow: string }

export interface WorkflowContext {
  /** 上一步的输出（或初始输入）。 */
  input: unknown
  /** 跨步骤共享状态，业务侧可读写。 */
  state: Record<string, unknown>
  signal?: AbortSignal
  onEvent?: (event: WorkflowEvent) => void
  /** 审批处理器：step 内通过 invokeCapability 调用需要确认的能力时使用。 */
  onApproval?: ToolApprovalHandler
  /** step 内如果嵌套 Agent，可把其运行事件继续上抛。 */
  onAgentEvent?: (event: RunEvent) => void
}

export interface StepResult {
  output?: unknown
}

export interface WorkflowStep {
  name: string
  /** 失败后的重试次数（默认 0）。 */
  retry?: number
  execute(context: WorkflowContext): Promise<unknown | StepResult>
}

export interface WorkflowDefinition {
  name: string
  description?: string
  steps: WorkflowStep[]
}

export interface Workflow extends WorkflowDefinition {
  kind: 'workflow'
}

/** 定义业务流程。Workflow 只是可执行流程定义，不属于编辑器业务逻辑。 */
export function defineWorkflow(definition: WorkflowDefinition): Workflow {
  return {
    kind: 'workflow',
    ...definition,
  }
}

export type WorkflowStatus = 'completed' | 'failed' | 'aborted'

export interface WorkflowRunResult {
  workflow: string
  status: WorkflowStatus
  state: Record<string, unknown>
  output?: unknown
  error?: string
  logs: WorkflowEvent[]
}

export interface WorkflowRunOptions {
  signal?: AbortSignal
  onEvent?: (event: WorkflowEvent) => void
  onApproval?: ToolApprovalHandler
  onAgentEvent?: (event: RunEvent) => void
  /** 恢复执行：从第几个 step 继续（0-based）。 */
  resumeFrom?: number
  /** 恢复执行：带入已有 state。 */
  state?: Record<string, unknown>
}

/**
 * Workflow Runtime：只负责执行业务侧传入的 Workflow。
 *
 * 提供顺序执行、上下文传递、异常处理、中断、恢复、日志、执行状态和重试，
 * 但不理解任何具体业务语义。
 */
export class WorkflowRuntime {
  async run(
    workflow: Workflow,
    input: unknown,
    options: WorkflowRunOptions = {},
  ): Promise<WorkflowRunResult> {
    const logs: WorkflowEvent[] = []
    const state: Record<string, unknown> = { ...(options.state ?? {}) }
    const emit = (event: WorkflowEvent) => {
      logs.push(event)
      options.onEvent?.(event)
    }

    emit({ type: 'workflow-start', workflow: workflow.name })

    let current = input

    for (let index = options.resumeFrom ?? 0; index < workflow.steps.length; index++) {
      if (options.signal?.aborted) {
        emit({ type: 'workflow-abort', workflow: workflow.name })
        return { workflow: workflow.name, status: 'aborted', state, logs }
      }

      const step = workflow.steps[index]!
      emit({ type: 'step-start', workflow: workflow.name, step: step.name, index })

      const context: WorkflowContext = {
        input: current,
        state,
        signal: options.signal,
        onEvent: options.onEvent,
        onApproval: options.onApproval,
        onAgentEvent: options.onAgentEvent,
      }

      try {
        const output = await this.executeStep(step, context, emit, workflow.name, index, options.signal)
        current = unwrapStepOutput(output)
        state[step.name] = current
        emit({ type: 'step-complete', workflow: workflow.name, step: step.name, index, output: current })
      }
      catch (error) {
        const message = toMessage(error)
        emit({ type: 'step-error', workflow: workflow.name, step: step.name, index, error: message })
        return { workflow: workflow.name, status: 'failed', state, error: message, logs }
      }
    }

    emit({ type: 'workflow-complete', workflow: workflow.name, output: current })
    return { workflow: workflow.name, status: 'completed', state, output: current, logs }
  }

  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext,
    emit: (event: WorkflowEvent) => void,
    workflowName: string,
    index: number,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const maxAttempts = Math.max(1, (step.retry ?? 0) + 1)
    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (signal?.aborted) {
        throw new DOMException('aborted', 'AbortError')
      }

      try {
        return await step.execute(context)
      }
      catch (error) {
        lastError = error
        if (attempt < maxAttempts) {
          emit({
            type: 'step-retry',
            workflow: workflowName,
            step: step.name,
            index,
            attempt,
            error: toMessage(error),
          })
        }
      }
    }

    throw lastError
  }
}

function unwrapStepOutput(result: unknown): unknown {
  if (result && typeof result === 'object' && 'output' in result) {
    return (result as { output?: unknown }).output
  }
  return result
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
