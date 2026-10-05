import type { Agent, FunctionTool, JsonObjectSchema, ToolRunContext }
  from '../Agent'
import type { RunEvent, RunOptions, RunResult }
  from './run'

/**
 * `agent.asTool()` 把「一个 Agent」包装成「一个工具」。
 *
 * 这样负责流程的父 Agent 不需要自己写 `if/else` 去决定调用哪个子 Agent，
 * 只要把若干子 Agent 作为 tool 注册进去，模型在推理时会自己挑选：
 *
 * ```ts
 * const flowAgent = new Agent({
 *   name: 'flow',
 *   instructions: '按需调用下面这些子 Agent',
 *   tools: [
 *     verifyAgent.asTool({ toolName: 'verify_configuration' }),
 *     layoutAgent.asTool({ toolName: 'generate_layout' }),
 *   ],
 * })
 * ```
 */
export interface AgentAsToolOptions {
  /** 暴露给上层模型的函数名，默认由 `agent.name` 规整成合法的 function name */
  toolName?: string
  /** 工具描述，模型据此判断何时调用哪个子 Agent；默认取 handoffDescription */
  toolDescription?: string
  /** 子 Agent 最多执行几轮「模型 → 工具 → 模型」 */
  maxTurns?: number
  /** 是否需要人工确认后才允许调用这个子 Agent */
  needsApproval?: FunctionTool['needsApproval']
  /**
   * 子 Agent 运行时透传的宿主钩子：
   * - `onEvent`：把子 Agent 内部的步骤也画进对话（嵌套 agent 的可视化）
   * - `onApproval`：覆盖子 Agent 的审批处理（默认沿用父级 Agent 的审批）
   */
  runOptions?: Pick<RunOptions, 'onEvent' | 'onApproval'>
  /**
   * 在调用子 Agent 之前加工入参。
   * 用来把宿主侧的运行数据（组件表、页面上下文等）补进模型的输入。
   */
  buildInput?: (input: string) => string | Promise<string>
  /** 把子 Agent 的运行结果转成返回给上层模型的字符串，默认取最终文本 */
  extractOutput?: (result: RunResult, agent: Agent<any, any>) => string
}

/** 子 Agent 工具统一以单个 `input` 字符串作为入参 */
const AGENT_TOOL_PARAMETERS: JsonObjectSchema<any> = {
  type: 'object',
  properties: {
    input: {
      type: 'string',
      description: '交给该子 Agent 的完整、自包含的任务描述或数据（结构化数据用 JSON 字符串）。',
    },
  },
  required: ['input'],
  additionalProperties: false,
}

/** function name 只允许 [a-zA-Z0-9_-]，这里把 agent.name 规整一下 */
export function toToolName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return (slug || 'agent').slice(0, 64)
}

function toDescription(agent: Agent<any, any>): string {
  const handoff = agent.handoffDescription?.trim()
  if (handoff) {
    return handoff
  }

  const firstLine = agent.instructions
    .split('\n')
    .map(line => line.trim())
    .find(Boolean)

  return firstLine ? firstLine.slice(0, 240) : `子 Agent：${agent.name}`
}

/** 子 Agent 只调了工具、没吐文本时，别把空字符串丢回给上层模型 */
function defaultExtractOutput(result: RunResult): string {
  if (result.text.trim()) {
    return result.text
  }

  const fallback = result.toolCalls.map(call => ({
    name: call.name,
    result: call.result,
    error: call.error,
  }))

  return JSON.stringify(fallback)
}

/**
 * 把一个 Agent 包装成 FunctionTool。
 * 独立导出，方便在 `Agent` 之外（比如自定义 registry）复用。
 */
export function createAgentTool(
  agent: Agent<any, any>,
  options: AgentAsToolOptions = {},
): FunctionTool {
  const name = options.toolName ?? toToolName(agent.name)
  const description = options.toolDescription ?? toDescription(agent)

  return {
    type: 'function',
    name,
    description,
    parameters: AGENT_TOOL_PARAMETERS,
    needsApproval: options.needsApproval,
    async invoke(rawInput: { input?: string } | string, context?: ToolRunContext): Promise<string> {
      // 动态引入，避免 Agent 模块在导入时就初始化 Runner / 模型客户端
      const { run, Runner } = await import('./run')

      const raw = typeof rawInput === 'string' ? rawInput : rawInput?.input ?? ''
      const input = options.buildInput ? await options.buildInput(raw) : raw

      const runOptions: RunOptions = {
        // 默认继承父级运行：嵌套子 Agent 的事件 / 审批继续冒泡到最外层
        onEvent: options.runOptions?.onEvent ?? context?.onEvent,
        onApproval: options.runOptions?.onApproval ?? context?.onApproval,
      }

      const result = options.maxTurns == null
        ? await run(agent, input, runOptions)
        : await new Runner({ maxTurns: options.maxTurns }).run(agent, input, runOptions)

      return options.extractOutput
        ? options.extractOutput(result, agent)
        : defaultExtractOutput(result)
    },
  }
}

export type { RunEvent }
