import type { z } from 'zod'
import type { AgentHostApi, EditorAgentContext } from './types'

/** Workflow roles understood by the built-in agent topology. */
export type AgentToolRole = 'initialization'

export interface AgentToolContext {
  api: AgentHostApi
  getContext: () => Record<string, unknown>
  /** Mutable context belonging to the current Agent Run. */
  context: EditorAgentContext
  signal?: AbortSignal
}

export interface AgentToolApprovalOptions {
  message?: (input: any) => string
}

export interface AgentToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Discriminator that keeps plain tool definitions distinct from SDK objects. */
  kind?: 'agent-tool'
  name: string
  description: string
  /** Optional workflow role used by the agent topology. */
  role?: AgentToolRole
  parameters?: z.ZodType
  /** Alias kept for existing capability definitions. */
  inputSchema?: z.ZodType
  needsApproval?: boolean | ((input: TInput) => boolean | Promise<boolean>)
  approval?: AgentToolApprovalOptions
  execute: (
    input: TInput,
    context: AgentToolContext,
  ) => TOutput | Promise<TOutput>
}

/**
 * Define a business tool consumed by the agent. Tools stay owned by the host:
 * the element only adapts them to the Agents SDK at runtime.
 */
export function defineAgentTool<TInput = unknown, TOutput = unknown>(
  definition: AgentToolDefinition<TInput, TOutput>,
): AgentToolDefinition<TInput, TOutput> {
  return { ...definition, kind: 'agent-tool' }
}

/** Backwards-compatible name for hosts that already use the capability API. */
export const defineCapability = defineAgentTool
