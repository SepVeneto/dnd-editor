import type { Agent } from "../Agent";
import type { ModelInput, ModelStreamEvent } from "./model";
import { getStreamedResponse } from "./model";

/** 一次工具调用的完整记录：模型请求的入参 + 工具真正执行的结果 */
export interface ToolCallResult {
  callId: string
  name: string
  args: unknown
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

const DEFAULT_MAX_TURNS = 8

type FunctionCallEvent = Extract<ModelStreamEvent, { type: 'function-call' }>

export class Runner {
  public config: RunConfig

  constructor(config: Partial<RunConfig> = {}) {
    this.config = {
      maxTurns: config.maxTurns ?? DEFAULT_MAX_TURNS,
    }
  }

  async run(agent: Agent<any, any>, input: string): Promise<RunResult> {
    const text: string[] = []
    const toolCalls: ToolCallResult[] = []

    let modelInput: ModelInput = input
    let previousResponseId: string | undefined

    for (let turn = 0; turn < this.config.maxTurns; turn++) {
      const functionCalls: FunctionCallEvent[] = []

      for await (const event of getStreamedResponse(agent, modelInput, previousResponseId)) {
        switch (event.type) {
          case 'text-delta':
            text.push(event.text)
            break
          case 'function-call':
            functionCalls.push(event)
            break
          case 'completed':
            previousResponseId = event.responseId
            break
        }
      }

      // 模型没有再请求工具，本次运行结束
      if (!functionCalls.length) {
        break
      }

      // 执行工具，并把每个结果作为 function_call_output 交回模型，
      // 让模型基于真实结果继续下一轮（或直接给出最终回答）。
      const outputs: ModelInput = []
      for (const call of functionCalls) {
        const result = await invokeTool(agent, call)
        toolCalls.push(result)
        outputs.push({
          type: 'function_call_output',
          call_id: call.callId,
          output: serializeToolResult(result),
        })
      }

      modelInput = outputs
    }

    return { text: text.join(''), toolCalls }
  }
}

async function invokeTool(agent: Agent<any, any>, call: FunctionCallEvent): Promise<ToolCallResult> {
  const { callId, name, args } = call

  const tool = agent.tools.find(item => item.name === name)
  if (!tool) {
    return { callId, name, args, error: `工具 ${name} 未在 Agent ${agent.name} 上注册` }
  }

  let parsed: unknown
  try {
    parsed = args ? JSON.parse(args) : {}
  } catch {
    return { callId, name, args, error: `工具 ${name} 的入参不是合法 JSON：${args}` }
  }

  try {
    const result = await tool.invoke(parsed)
    return { callId, name, args: parsed, result }
  } catch (error) {
    return { callId, name, args: parsed, error: toMessage(error) }
  }
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

const defaultRunner = new Runner()
export async function run<TAgent extends Agent<any, any>>(agent: TAgent, input: string): Promise<RunResult> {
  return await defaultRunner.run(agent, input)
}
