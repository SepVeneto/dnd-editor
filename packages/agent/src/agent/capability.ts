import { tool } from '@openai/agents'
import type { FunctionTool, RunContext } from '@openai/agents'
import { z } from 'zod'
import type { AppContext, ToolApprovalHandler } from './context'

export type CapabilitySchema = z.ZodType

export interface CapabilityContext {
  onApproval?: ToolApprovalHandler
  signal?: AbortSignal
  state?: Record<string, unknown>
}

export interface ToolApprovalOptions {
  message?: (input: any) => string
  onApprove?: (input: any) => void
  onReject?: (input: any) => void
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

export function defineCapability<TInput, TOutput>(
  definition: CapabilityDefinition<TInput, TOutput>,
): Capability<TInput, TOutput> {
  return { kind: 'capability', ...definition }
}

function capabilityParameters(capability: Capability<any, any>): z.ZodObject<any> {
  if (capability.inputSchema && capability.inputSchema instanceof z.ZodObject) {
    return capability.inputSchema as z.ZodObject<any>
  }
  return z.object({ input: z.string().optional() })
}

/** Capability -> OpenAI Agents SDK FunctionTool（V2 的 Capability Adapter）。 */
export function createCapabilityTool(capability: Capability<any, any>): FunctionTool<any, any, any> {
  return tool({
    name: capability.name,
    description: capability.description,
    parameters: capabilityParameters(capability) as any,
    strict: true,
    async execute(input: any, runContext?: RunContext<any>) {
      const context = runContext?.context as AppContext | undefined
      const capabilityContext: CapabilityContext = {
        state: context?.state,
        onApproval: context?.onApproval,
        signal: context?.signal,
      }

      // 需要人工确认的能力，先走审批，用户不同意就不执行。
      const approved = await ensureCapabilityApproval(capability, input, capabilityContext)
      if (!approved) {
        return { ok: false, rejected: true, message: `用户不同意执行 ${capability.name}` }
      }

      try {
        return await capability.execute(input, capabilityContext)
      }
      catch (error) {
        // 不向模型抛异常，返回结构化错误，避免模型反复重试同一个工具调用。
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  })
}

let capabilityCallSeq = 0

/** 工作流 Step 里直接调用能力时使用，统一处理审批。 */
export async function invokeCapability<TInput = unknown, TOutput = unknown>(
  capability: Capability<TInput, TOutput>,
  input: TInput,
  context: CapabilityContext = {},
): Promise<TOutput> {
  const approved = await ensureCapabilityApproval(capability, input, context)
  if (!approved) {
    throw new Error(`用户不同意执行 ${capability.name}`)
  }
  return await capability.execute(input, context)
}

async function ensureCapabilityApproval(
  capability: Capability<any, any>,
  input: any,
  context: CapabilityContext,
): Promise<boolean> {
  const requires = await resolveCapabilityApproval(capability.needsApproval, input)
  if (!requires) {
    return true
  }

  const message = capability.approval?.message?.(input) ?? `是否执行 ${capability.name}？`
  const approved = context.onApproval
    ? await context.onApproval({
        callId: `cap-${++capabilityCallSeq}`,
        name: capability.name,
        args: input,
        message,
      })
    : false

  if (approved) {
    capability.approval?.onApprove?.(input)
  }
  else {
    capability.approval?.onReject?.(input)
  }
  return approved
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
