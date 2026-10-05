import type { Agent, FunctionTool, ToolApprovalHandler } from "../Agent";
import type { ChatMessage, ModelStreamEvent } from "./model";
import { getStreamedResponse } from "./model";

/** 一次工具调用的完整记录：模型请求的入参 + 工具真正执行的结果 */
export interface ToolCallResult {
  callId: string
  name: string
  args: unknown
  /** 需要人工确认的工具，记录最终是同意还是拒绝 */
  approval?: 'approved' | 'rejected'
  result?: unknown
  error?: string
}

export interface RunResult {
  /** 模型输出的文本 */
  text: string
  /** 本次运行里执行过的所有工具调用及其结果 */
  toolCalls: ToolCallResult[]
}

export interface RunConfig {
  /** 最多执行几轮「模型 → 工具 → 模型」，防止死循环 */
  maxTurns: number
}

export interface RunOptions {
  /**
   * 工具声明 needsApproval 时，runtime 会暂停并调用它等用户确认。
   * 返回 true 执行工具，返回 false 跳过该工具（例如「不开通，问下一个」）。
   */
  onApproval?: ToolApprovalHandler
  /** 运行时的每一步都会实时抛出，宿主可以据此做可视化 */
  onEvent?: (event: RunEvent) => void
}

/** 运行过程的可视化事件 */
export type RunEvent
  /** 开始新一轮「模型 → 工具」 */
  = | { type: 'turn-start', turn: number }
  /** 模型输出的文本增量 */
    | { type: 'assistant-text', text: string }
  /** 模型请求调用某个工具 */
    | { type: 'tool-call', callId: string, name: string, args: unknown }
  /** 某个工具需要人工确认 */
    | { type: 'approval-request', callId: string, name: string, args: unknown, message: string }
  /** 用户对审批给出的决策 */
    | { type: 'approval-result', callId: string, name: string, approved: boolean }
  /** 工具执行结束（成功或失败） */
    | { type: 'tool-result', callId: string, name: string, result?: unknown, error?: string }

const DEFAULT_MAX_TURNS = 8

type FunctionCallEvent = Extract<ModelStreamEvent, { type: 'function-call' }>

export class Runner {
  public config: RunConfig

  constructor(config: Partial<RunConfig> = {}) {
    this.config = {
      maxTurns: config.maxTurns ?? DEFAULT_MAX_TURNS,
    }
  }

  async run(agent: Agent<any, any>, input: string, options: RunOptions = {}): Promise<RunResult> {
    const text: string[] = []
    const toolCalls: ToolCallResult[] = []
    const emit = (event: RunEvent) => options.onEvent?.(event)

    const messages: ChatMessage[] = []
    if (agent.instructions) {
      messages.push({ role: 'system', content: agent.instructions })
    }
    messages.push({ role: 'user', content: input })

    for (let turn = 0; turn < this.config.maxTurns; turn++) {
      emit({ type: 'turn-start', turn: turn + 1 })
      const functionCalls: FunctionCallEvent[] = []
      let turnText = ''

      for await (const event of getStreamedResponse(agent, messages)) {
        switch (event.type) {
          case 'text-delta':
            text.push(event.text)
            turnText += event.text
            emit({ type: 'assistant-text', text: event.text })
            break
          case 'function-call':
            functionCalls.push(event)
            emit({ type: 'tool-call', callId: event.callId, name: event.name, args: parseArgsSafe(event.args) })
            break
        }
      }

      // 模型没有再请求工具，本次运行结束
      if (!functionCalls.length) {
        break
      }

      // 把模型这一轮的回复（含 tool_calls）写回上下文
      messages.push({
        role: 'assistant',
        content: turnText || null,
        tool_calls: functionCalls.map(call => ({
          id: call.callId,
          type: 'function',
          function: { name: call.name, arguments: call.args },
        })),
      })

      // 执行工具，并把结果作为 tool 消息交回模型继续下一轮
      for (const call of functionCalls) {
        const result = await invokeTool(agent, call, options, emit)
        console.log('tool result', result)
        toolCalls.push(result)
        messages.push({
          role: 'tool',
          tool_call_id: call.callId,
          content: serializeToolResult(result),
        })
      }
    }

    return { text: text.join(''), toolCalls }
  }
}

async function invokeTool(
  agent: Agent<any, any>,
  call: FunctionCallEvent,
  options: RunOptions,
  emit: (event: RunEvent) => void,
): Promise<ToolCallResult> {
  const result = await executeTool(agent, call, options, emit)
  emit({
    type: 'tool-result',
    callId: result.callId,
    name: result.name,
    result: result.result,
    error: result.error,
  })
  return result
}

async function executeTool(
  agent: Agent<any, any>,
  call: FunctionCallEvent,
  options: RunOptions,
  emit: (event: RunEvent) => void,
): Promise<ToolCallResult> {
  const { callId, name, args } = call

  const tool = agent.tools.find(item => item.name === name)
  if (!tool) {
    return { callId, name, args, error: `工具 ${name} 未在 Agent ${agent.name} 上注册` }
  }

  // 工具执行时把父级运行的钩子透传下去，嵌套子 Agent 才能继续冒泡事件 / 审批
  const context = { onEvent: emit, onApproval: options.onApproval ?? agent.approval.onApproval }

  let parsed: unknown
  try {
    parsed = args ? JSON.parse(args) : {}
  } catch {
    return { callId, name, args, error: `工具 ${name} 的入参不是合法 JSON：${args}` }
  }

  const needsApproval = await resolveNeedsApproval(tool, parsed)
  if (needsApproval) {
    // 审批状态由 Agent 管理；文案 / 回调来自工具配置
    const onApproval = options.onApproval ?? agent.approval.onApproval
    const message = tool.approval?.message?.(parsed) ?? `是否执行工具 ${name}？`
    // 运行时在这里停下来等宿主（对话框底部）给出「同意 / 不同意」
    emit({ type: 'approval-request', callId, name, args: parsed, message })
    const approved = await onApproval({ callId, name, args: parsed, message })
    if (approved) {
      tool.approval?.onApprove?.(parsed)
    }
    else {
      tool.approval?.onReject?.(parsed)
    }
    emit({ type: 'approval-result', callId, name, approved })
    if (!approved) {
      return {
        callId,
        name,
        args: parsed,
        approval: 'rejected',
        error: `用户不同意执行 ${name}`,
      }
    }

    try {
      const result = await tool.invoke(parsed, context)
      return { callId, name, args: parsed, approval: 'approved', result }
    } catch (error) {
      return { callId, name, args: parsed, approval: 'approved', error: toMessage(error) }
    }
  }

  try {
    const result = await tool.invoke(parsed, context)
    return { callId, name, args: parsed, result }
  } catch (error) {
    return { callId, name, args: parsed, error: toMessage(error) }
  }
}

async function resolveNeedsApproval(tool: FunctionTool, input: unknown): Promise<boolean> {
  const { needsApproval } = tool
  if (typeof needsApproval === 'function') {
    return !!(await needsApproval(input))
  }
  return !!needsApproval
}

function serializeToolResult(call: ToolCallResult): string {
  if (call.error) {
    return JSON.stringify({ error: call.error })
  }
  if (typeof call.result === 'string') {
    return call.result
  }
  return JSON.stringify(call.result ?? null)
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function parseArgsSafe(args: string): unknown {
  if (!args)
    return {}
  try {
    return JSON.parse(args)
  } catch {
    return args
  }
}

const defaultRunner = new Runner()
export async function run<TAgent extends Agent<any, any>>(
  agent: TAgent,
  input: string,
  options: RunOptions = {},
): Promise<RunResult> {
  return await defaultRunner.run(agent, input, options)
}
