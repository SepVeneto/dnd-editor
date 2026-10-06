import { z } from 'zod'
import type {
  FunctionTool,
  JsonObjectSchema,
  ToolApprovalHandler,
  ToolApprovalOptions,
  ToolRunContext,
} from './Agent'

/** 业务能力入参 / 出参的 schema，业务侧可以用 zod 描述。 */
export type CapabilitySchema = z.ZodType

/** Capability 执行时由平台注入的上下文。 */
export interface CapabilityContext {
  /** 运行事件钩子：把内部步骤继续上抛给宿主。 */
  onEvent?: ToolRunContext['onEvent']
  /** 审批处理器：需要人工确认时由平台调用。 */
  onApproval?: ToolApprovalHandler
  /** 中断信号。 */
  signal?: AbortSignal
  /** 运行时共享状态。 */
  state?: Record<string, unknown>
}

export interface CapabilityDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema?: CapabilitySchema
  outputSchema?: CapabilitySchema
  needsApproval?: boolean | ((input: TInput) => boolean | Promise<boolean>)
  approval?: ToolApprovalOptions
  execute(input: TInput, context: CapabilityContext): Promise<TOutput> | TOutput
}

export interface Capability<TInput = unknown, TOutput = unknown>
  extends CapabilityDefinition<TInput, TOutput> {
  kind: 'capability'
}

/**
 * 定义业务能力。
 *
 * 业务侧只需要描述能力本身（名称、描述、schema、execute），
 * 不需要编写 Agent、Prompt、Tool 或 Runtime。
 */
export function defineCapability<TInput, TOutput>(
  definition: CapabilityDefinition<TInput, TOutput>,
): Capability<TInput, TOutput> {
  return {
    kind: 'capability',
    ...definition,
  }
}

export function capabilitySchemaToJsonSchema(schema?: CapabilitySchema): JsonObjectSchema<any> {
  if (!schema) {
    return {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: true,
    }
  }

  const instance = schema as unknown as { toJSONSchema?: () => unknown }
  if (typeof instance.toJSONSchema === 'function') {
    return instance.toJSONSchema() as JsonObjectSchema<any>
  }

  return schema as unknown as JsonObjectSchema<any>
}

/**
 * 把 Capability 包装成 Agent Tool。
 *
 * 注意：这里的 `needsApproval` 由 Agent Runtime（core/run）统一处理，
 * `invoke` 本身不重复处理审批；工作流步骤直接调用时应使用 `invokeCapability`。
 */
export function createCapabilityTool<TInput = unknown, TOutput = unknown>(
  capability: Capability<TInput, TOutput>,
): FunctionTool {
  return {
    type: 'function',
    name: capability.name,
    description: capability.description,
    parameters: capabilitySchemaToJsonSchema(capability.inputSchema),
    needsApproval: capability.needsApproval,
    approval: capability.approval,
    async invoke(input: TInput, context?: ToolRunContext): Promise<string | TOutput> {
      const result = await capability.execute(input, context ?? {})
      return result as string | TOutput
    },
  }
}

let capabilityCallSeq = 0

/**
 * 直接执行一个 Capability（工作流步骤、宿主手动调用等场景），统一处理审批。
 */
export async function invokeCapability<TInput = unknown, TOutput = unknown>(
  capability: Capability<TInput, TOutput>,
  input: TInput,
  context: CapabilityContext = {},
): Promise<TOutput> {
  const requires = await resolveCapabilityApproval(capability.needsApproval, input)
  if (requires) {
    const message = capability.approval?.message?.(input) ?? `是否执行 ${capability.name}？`
    const onApproval = context.onApproval
    const approved = onApproval
      ? await onApproval({
        callId: `cap-${++capabilityCallSeq}`,
        name: capability.name,
        args: input,
        message,
      })
      : false

    if (!approved) {
      capability.approval?.onReject?.(input)
      throw new Error(`用户不同意执行 ${capability.name}`)
    }

    capability.approval?.onApprove?.(input)
  }

  return await capability.execute(input, context)
}

async function resolveCapabilityApproval<TInput>(
  needsApproval: Capability<TInput, any>['needsApproval'],
  input: TInput,
): Promise<boolean> {
  if (typeof needsApproval === 'function') {
    return !!(await needsApproval(input))
  }
  return !!needsApproval
}
