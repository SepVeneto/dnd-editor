import { MemorySession } from '@openai/agents'
import type { Agent, AgentInputItem, RunStreamEvent } from '@openai/agents'
import { createCapabilityAgent } from './capabilityAgent'
import type { Capability } from './capability'
import type { AppContext, ToolApprovalHandler } from './context'
import { runAgentStreamed } from './core/sdk'
import { createEditAgent } from './editAgent'
import { createFlowAgent } from './flowAgent'
import { parseJson } from './extract'
import type { FlowType } from './flowAgent'
import type { EditIR, LayoutIR } from './ir'
import type { NormalizedElements } from './ir'
import { generateLayoutIR } from './layout'
import type { LayoutWidgetDescriptor } from './layout'
import { WorkflowRuntime } from './workflow'
import type { Workflow, WorkflowEvent, WorkflowRunResult } from './workflow'

export type AgentRuntimeEvent =
  | { type: 'text-delta', text: string }
  | { type: 'tool-call', callId: string, name: string, args: unknown }
  | { type: 'tool-result', callId: string, name: string, result?: unknown, error?: string }
  | { type: 'agent-updated', agent: string }
  | WorkflowEvent

export interface AgentRuntimeResult {
  flow: FlowType
  text?: string
  layout?: LayoutIR
  edits?: EditIR[]
  capability?: { name: string, result: unknown }
  workflow?: WorkflowRunResult
}

export interface AgentRuntimeOptions {
  capabilities?: Capability<any, any>[]
  workflows?: Workflow[]
  context?: () => Record<string, unknown>
  extractLayout?: (output: unknown) => LayoutIR | undefined
}

export interface AgentRuntimeHooks {
  onEvent?: (event: AgentRuntimeEvent) => void
  onApproval?: ToolApprovalHandler
}

const DEFAULT_MAX_TURNS = 8

/**
 * 编辑器平台提供的 Agent Runtime。
 *
 * Agent Loop / Tool Calling / Session / Context 全部由 OpenAI Agents SDK 提供；
 * 模型接口调用走原来的 chat.completions（服务器代理），见 core/sdk.ts。
 */
export class AgentRuntime {
  public flowAgent: Agent<any, any>
  public editAgent: Agent<any, any>
  public capabilityAgent: Agent<any, any>
  public workflowRuntime: WorkflowRuntime

  private readonly capabilities: Capability<any, any>[]
  private readonly workflows: Workflow[]
  private readonly options: AgentRuntimeOptions
  private readonly flowSession: MemorySession

  constructor(options: AgentRuntimeOptions = {}) {
    this.capabilities = options.capabilities ?? []
    this.workflows = options.workflows ?? []
    this.options = options
    this.flowAgent = createFlowAgent({ workflows: this.workflows, capabilities: this.capabilities })
    this.editAgent = createEditAgent({ capabilities: this.capabilities })
    this.capabilityAgent = createCapabilityAgent({ capabilities: this.capabilities })
    this.workflowRuntime = new WorkflowRuntime()
    this.flowSession = new MemorySession()
  }

  async run(input: string | AgentInputItem[], hooks: AgentRuntimeHooks = {}): Promise<AgentRuntimeResult> {
    const appContext: AppContext = {
      state: this.options.context?.() ?? {},
      onApproval: hooks.onApproval,
    }

    const flowResult = await runAgentStreamed(this.flowAgent, input, {
      session: this.flowSession,
      context: appContext,
      maxTurns: DEFAULT_MAX_TURNS,
    })
    for await (const event of flowResult) {
      const mapped = mapStreamEvent(event)
      if (mapped) {
        hooks.onEvent?.(mapped)
      }
    }

    const classification = parseFlowClassification(flowResult.finalOutput, {
      hasWorkflow: this.workflows.length > 0,
      hasCapabilities: this.capabilities.length > 0,
    })
    // 始终把原始用户输入交给下游：Flow Agent 只做路由，不改写/压缩输入。
    const effectiveInput = input

    if (classification.flow === 'initialize') {
      return this.runInitialize(effectiveInput, appContext, hooks)
    }
    if (classification.flow === 'edit') {
      return this.runEdit(effectiveInput, appContext, hooks)
    }
    return this.runCapability(effectiveInput, appContext, hooks)
  }

  async reset(): Promise<void> {
    await this.flowSession.clearSession()
  }

  private async runInitialize(
    input: string | AgentInputItem[],
    appContext: AppContext,
    hooks: AgentRuntimeHooks,
  ): Promise<AgentRuntimeResult> {
    const workflow = this.workflows.find(item => item.name === 'initialize') ?? this.workflows[0]
    if (!workflow) {
      return { flow: 'initialize', text: '没有注册初始化流程。' }
    }

    const workflowResult = await this.workflowRuntime.run(workflow, input, {
      state: { ...appContext.state },
      onEvent: event => hooks.onEvent?.(event),
      onApproval: hooks.onApproval,
    })

    if (workflowResult.status !== 'completed') {
      return { flow: 'initialize', text: workflowResult.error ?? '初始化流程未完成。', workflow: workflowResult }
    }

    const widgets = (appContext.state.widgets ?? []) as LayoutWidgetDescriptor[]
    const layout = this.options.extractLayout
      ? this.options.extractLayout(workflowResult.output)
      : await generateLayoutIR({ elements: (workflowResult.output ?? []) as NormalizedElements, widgets })

    return { flow: 'initialize', layout, workflow: workflowResult }
  }

  private async runEdit(
    input: string | AgentInputItem[],
    appContext: AppContext,
    hooks: AgentRuntimeHooks,
  ): Promise<AgentRuntimeResult> {
    const composed = [
      `用户输入：${input}`,
      `当前编辑器状态：${JSON.stringify(appContext.state, null, 2)}`,
    ].join('\n\n')

    const result = await runAgentStreamed(this.editAgent, composed, {
      context: appContext,
      maxTurns: DEFAULT_MAX_TURNS,
    })
    for await (const event of result) {
      const mapped = mapStreamEvent(event)
      if (mapped) {
        hooks.onEvent?.(mapped)
      }
    }

    const output = parseJson(String(result.finalOutput ?? '')) as { edits?: unknown } | undefined
    const edits = Array.isArray(output?.edits) ? output.edits as EditIR[] : []
    return { flow: 'edit', text: JSON.stringify(edits), edits }
  }

  private async runCapability(
    input: string | AgentInputItem[],
    appContext: AppContext,
    hooks: AgentRuntimeHooks,
  ): Promise<AgentRuntimeResult> {
    const composed = [
      `用户输入：${input}`,
    ].join('\n\n')

    const result = await runAgentStreamed(this.capabilityAgent, composed, {
      context: appContext,
      maxTurns: DEFAULT_MAX_TURNS,
    })
    for await (const event of result) {
      const mapped = mapStreamEvent(event)
      if (mapped) {
        hooks.onEvent?.(mapped)
      }
    }

    const call = extractFirstToolCall(result)
    return {
      flow: 'capability',
      text: String(result.finalOutput ?? ''),
      capability: call ? { name: call.name, result: call.output } : undefined,
    }
  }
}

export function createAgentRuntime(options: AgentRuntimeOptions = {}): AgentRuntime {
  return new AgentRuntime(options)
}

function parseFlowClassification(
  output: unknown,
  options: { hasWorkflow: boolean, hasCapabilities: boolean },
): { flow: FlowType, input?: string, note?: string } {
  const text = typeof output === 'string' ? output : JSON.stringify(output ?? '')
  const parsed = parseJson(text)
  if (parsed && typeof parsed === 'object') {
    const value = parsed as { flow?: unknown, input?: unknown, note?: unknown }
    if (value.flow === 'initialize' || value.flow === 'edit' || value.flow === 'capability') {
      return {
        flow: value.flow,
        input: typeof value.input === 'string' ? value.input : undefined,
        note: typeof value.note === 'string' ? value.note : undefined,
      }
    }
  }

  if (options.hasWorkflow && /初始化|生成|创建|搭建|做一个|首页|布局/.test(text)) {
    return { flow: 'initialize' }
  }
  if (/删除|修改|移动|更新|添加|插入|调整|编辑|换|去掉|移除/.test(text)) {
    return { flow: 'edit' }
  }
  return options.hasCapabilities ? { flow: 'capability' } : { flow: 'edit' }
}

function mapStreamEvent(event: RunStreamEvent): AgentRuntimeEvent | undefined {
  if (event.type === 'raw_model_stream_event') {
    const data = event.data as any
    if (data?.type === 'output_text_delta') {
      return { type: 'text-delta', text: data.delta }
    }
    return undefined
  }

  if (event.type === 'run_item_stream_event') {
    if (event.name === 'tool_called') {
      const raw = (event.item as any).rawItem ?? {}
      return { type: 'tool-call', callId: raw.callId ?? raw.id, name: raw.name, args: parseArgsSafe(raw.arguments) }
    }
    if (event.name === 'tool_output') {
      const item = event.item as any
      return { type: 'tool-result', callId: item.rawItem?.callId, name: item.rawItem?.name, result: item.output }
    }
    return undefined
  }

  if (event.type === 'agent_updated_stream_event') {
    return { type: 'agent-updated', agent: event.agent.name }
  }

  return undefined
}

function extractFirstToolCall(result: any): { name: string, output: unknown } | undefined {
  const calls: Array<{ name: string, output: unknown }> = []
  for (const item of result.newItems ?? []) {
    if (item.type === 'tool_call_item') {
      const raw = item.rawItem ?? {}
      calls.push({ name: raw.name ?? '', output: undefined })
    }
    else if (item.type === 'tool_call_output_item') {
      const last = calls[calls.length - 1]
      if (last) {
        last.output = item.output
      }
    }
  }
  return calls.find(call => call.name)
}

function parseArgsSafe(args: string): unknown {
  if (!args) {
    return {}
  }
  try {
    return JSON.parse(args)
  }
  catch {
    return args
  }
}
