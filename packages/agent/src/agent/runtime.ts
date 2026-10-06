import type { Agent, ToolApprovalHandler } from './Agent'
import type { Capability } from './capability'
import { createCapabilityAgent } from './capabilityAgent'
import { createEditAgent } from './editAgent'
import { createFlowAgent } from './flowAgent'
import type { FlowType } from './flowAgent'
import type { EditIR, LayoutIR } from './ir'
import { generateLayoutIR } from './layout'
import type { LayoutWidgetDescriptor } from './layout'
import { parseJson } from './extract'
import { run } from './core/run'
import type { RunEvent } from './core/run'
import { WorkflowRuntime } from './workflow'
import type { Workflow, WorkflowEvent, WorkflowRunResult } from './workflow'

export type AgentRuntimeEvent = RunEvent | WorkflowEvent

export interface AgentRuntimeHooks {
  onEvent?: (event: AgentRuntimeEvent) => void
  onApproval?: ToolApprovalHandler
}

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
  /** 运行时上下文：组件列表、当前编辑器状态等，执行前动态求值。 */
  context?: () => Record<string, unknown>
  /** 从初始化工作流的最终输出里提取 Layout IR。 */
  extractLayout?: (output: unknown) => LayoutIR | undefined
}

/**
 * 编辑器平台提供的通用 Agent Runtime。
 *
 * 组合 Flow Agent / Edit Agent / Capability Agent 与 Workflow Runtime，
 * 业务侧只提供 Capability 与 Workflow。
 */
export class AgentRuntime {
  public flowAgent: Agent<any, any>
  public editAgent: Agent<any, any>
  public capabilityAgent: Agent<any, any>
  public workflowRuntime: WorkflowRuntime

  private readonly capabilities: Capability<any, any>[]
  private readonly workflows: Workflow[]
  private readonly options: AgentRuntimeOptions

  constructor(options: AgentRuntimeOptions = {}) {
    this.capabilities = options.capabilities ?? []
    this.workflows = options.workflows ?? []
    this.options = options
    this.flowAgent = createFlowAgent({ workflows: this.workflows, capabilities: this.capabilities })
    this.editAgent = createEditAgent({ capabilities: this.capabilities })
    this.capabilityAgent = createCapabilityAgent({ capabilities: this.capabilities })
    this.workflowRuntime = new WorkflowRuntime()
  }

  async run(input: string, hooks: AgentRuntimeHooks = {}): Promise<AgentRuntimeResult> {
    const onAgentEvent = hooks.onEvent as ((event: RunEvent) => void) | undefined
    const onWorkflowEvent = hooks.onEvent as ((event: WorkflowEvent) => void) | undefined

    const flowResult = await run(this.flowAgent, input, {
      onEvent: onAgentEvent,
      onApproval: hooks.onApproval,
    })

    const classification = parseFlowClassification(flowResult.text, {
      hasWorkflow: this.workflows.length > 0,
    })
    const effectiveInput = classification.input || input

    if (classification.flow === 'initialize') {
      return this.runInitialize(effectiveInput, onWorkflowEvent, hooks.onApproval, onAgentEvent)
    }

    if (classification.flow === 'edit') {
      return this.runEdit(effectiveInput, onAgentEvent, hooks.onApproval)
    }

    return this.runCapability(effectiveInput, onAgentEvent, hooks.onApproval)
  }

  private async runInitialize(
    input: string,
    onWorkflowEvent?: (event: WorkflowEvent) => void,
    onApproval?: ToolApprovalHandler,
    onAgentEvent?: (event: RunEvent) => void,
  ): Promise<AgentRuntimeResult> {
    const workflow = this.workflows.find(item => item.name === 'initialize') ?? this.workflows[0]
    if (!workflow) {
      return { flow: 'initialize', text: '没有注册初始化流程。' }
    }

    const context = this.options.context?.() ?? {}
    const workflowResult = await this.workflowRuntime.run(workflow, input, {
      state: { ...context },
      onEvent: onWorkflowEvent,
      onApproval,
      onAgentEvent,
    })

    if (workflowResult.status !== 'completed') {
      return { flow: 'initialize', text: workflowResult.error ?? '初始化流程未完成。', workflow: workflowResult }
    }

    const widgets = (context.widgets ?? []) as LayoutWidgetDescriptor[]
    const layout = this.options.extractLayout
      ? this.options.extractLayout(workflowResult.output)
      : await generateLayoutIR({ elements: workflowResult.output, widgets, onEvent: onAgentEvent })

    return { flow: 'initialize', layout, workflow: workflowResult }
  }

  private async runEdit(
    input: string,
    onAgentEvent?: (event: RunEvent) => void,
    onApproval?: ToolApprovalHandler,
  ): Promise<AgentRuntimeResult> {
    const context = this.options.context?.() ?? {}
    const composed = [
      `用户输入：${input}`,
      `当前编辑器状态：${JSON.stringify(context, null, 2)}`,
    ].join('\n\n')

    const result = await run(this.editAgent, composed, {
      onEvent: onAgentEvent,
      onApproval,
    })

    const parsed = parseJson(result.text)
    const edits = Array.isArray(parsed) ? parsed as EditIR[] : []
    return { flow: 'edit', text: result.text, edits }
  }

  private async runCapability(
    input: string,
    onAgentEvent?: (event: RunEvent) => void,
    onApproval?: ToolApprovalHandler,
  ): Promise<AgentRuntimeResult> {
    const context = this.options.context?.() ?? {}
    const composed = [
      `用户输入：${input}`,
      `当前上下文：${JSON.stringify(context, null, 2)}`,
    ].join('\n\n')

    const result = await run(this.capabilityAgent, composed, {
      onEvent: onAgentEvent,
      onApproval,
    })

    const call = result.toolCalls.find(item => !item.error) ?? result.toolCalls[0]
    return {
      flow: 'capability',
      text: result.text,
      capability: call ? { name: call.name, result: call.result } : undefined,
    }
  }

}

export function createAgentRuntime(options: AgentRuntimeOptions = {}): AgentRuntime {
  return new AgentRuntime(options)
}

function parseFlowClassification(
  text: string,
  options: { hasWorkflow: boolean },
): { flow: FlowType, input?: string, note?: string } {
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

  return { flow: 'edit' }
}
