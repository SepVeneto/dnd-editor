import OpenAI from 'openai'
import { run as agentsRun, Usage } from '@openai/agents'
import type {
  Agent,
  AgentInputItem,
  AgentOutputItem,
  Model,
  ModelRequest,
  ModelResponse,
  RunResult,
  RunStreamEvent,
  SerializedOutputType,
  Session,
  StreamEvent,
  StreamedRunResult,
} from '@openai/agents'

export interface ModelConfig {
  baseURL?: string
  apiKey?: string
  model?: string
}

const defaults: Required<ModelConfig> = {
  baseURL: 'http://localhost:4000/v1',
  apiKey: 'test',
  model: 'qwen-plus',
}

let config: Required<ModelConfig> = { ...defaults }
let client = createClient(config)

function createClient(next: Required<ModelConfig>): OpenAI {
  return new OpenAI({
    baseURL: next.baseURL,
    apiKey: next.apiKey,
    dangerouslyAllowBrowser: true,
  })
}

export function configureModel(next: ModelConfig): void {
  config = { ...config, ...next }
  client = createClient(config)
}

export function getModelConfig(): Required<ModelConfig> {
  return { ...config }
}

export function getModelName(): string {
  return config.model
}

/** 测试用：注入 mock 的 OpenAI client。 */
export function setMockClient(mock: OpenAI): void {
  client = mock
}

/**
 * 返回一个 Agents SDK 的 Model 适配器。
 *
 * 模型接口调用保持原来的方式：直接走 `openai` 的 `chat.completions`（服务器代理 baseURL）；
 * Agent Loop / Tool Calling / Session / Context 等其它能力全部由 OpenAI Agents SDK 提供。
 */
export function getModel(): Model {
  return new ProxyChatCompletionsModel(config.model)
}

class ProxyChatCompletionsModel implements Model {
  constructor(private readonly model: string) {}

  async getResponse(request: ModelRequest): Promise<ModelResponse> {
    const { messages, tools, responseFormat } = buildChatRequest(request)
    const stream = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: 0,
      stream: true,
      ...(tools ? { tools } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
    } as any) as any

    const { responseId, usage, text, functionCalls } = await accumulateStream(stream)

    return {
      output: buildOutput(responseId, text.join(''), functionCalls),
      responseId: responseId || 'proxy-response',
      usage: new Usage({
        requests: 1,
        input_tokens: usage?.prompt_tokens ?? 0,
        output_tokens: usage?.completion_tokens ?? 0,
        total_tokens: usage?.total_tokens ?? 0,
      }),
    }
  }

  async *getStreamedResponse(request: ModelRequest): AsyncIterable<StreamEvent> {
    const { messages, tools, responseFormat } = buildChatRequest(request)
    const stream = await client.chat.completions.create({
      model: this.model,
      messages: messages as any,
      temperature: 0,
      stream: true,
      ...(tools ? { tools } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
    } as any) as any

    let responseId = ''
    let usage: any
    const text: string[] = []
    const functionCalls: Array<{ id: string, callId: string, name: string, arguments: string }> = []
    let started = false

    for await (const chunk of stream) {
      if (!started) {
        started = true
        yield { type: 'response_started' }
      }
      if (chunk.id) {
        responseId = chunk.id
      }
      if (chunk.usage) {
        usage = chunk.usage
      }

      const delta = chunk.choices?.[0]?.delta
      if (!delta) {
        continue
      }

      if (delta.content) {
        text.push(delta.content)
        yield { type: 'output_text_delta', delta: delta.content }
      }

      for (const tc of delta.tool_calls ?? []) {
        const index = tc.index ?? 0
        if (!functionCalls[index]) {
          functionCalls[index] = { id: '', callId: '', name: '', arguments: '' }
        }
        if (tc.id) {
          functionCalls[index].callId = tc.id
        }
        if (tc.function?.name) {
          functionCalls[index].name += tc.function.name
        }
        if (tc.function?.arguments) {
          functionCalls[index].arguments += tc.function.arguments
        }
      }
    }

    const output = buildOutput(responseId, text.join(''), functionCalls)

    yield {
      type: 'response_done',
      response: {
        id: responseId || 'proxy-response',
        usage: {
          inputTokens: usage?.prompt_tokens ?? 0,
          outputTokens: usage?.completion_tokens ?? 0,
          totalTokens: usage?.total_tokens ?? 0,
          inputTokensDetails: {},
          outputTokensDetails: {},
        },
        output,
      } as any,
    }
  }
}

function buildChatRequest(request: ModelRequest): { messages: any[], tools?: any[], responseFormat?: any } {
  const messages: any[] = []
  if (request.systemInstructions) {
    messages.push({ role: 'system', content: request.systemInstructions })
  }

  if (typeof request.input === 'string') {
    messages.push({ role: 'user', content: request.input })
  }
  else {
    for (const item of request.input as AgentOutputItem[]) {
      const message = itemToChatMessage(item)
      if (message) {
        messages.push(message)
      }
    }
  }

  const tools = request.tools.length
    ? request.tools.filter(item => item.type === 'function').map((item) => {
        const tool = item as any
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: sanitizeSchema(tool.parameters),
          },
        }
      })
    : undefined

  // 参考 openai-sdk 的 getResponseFormat：无工具时按 outputType 下发 response_format，
  // Agent 声明了 ZodObject 结构化输出（json_schema）时下发 json_schema，否则退回 json_object
  // 保证平台 Agent 的最终输出仍是 JSON；有工具时不传，避免与 tools 冲突。
  const responseFormat = !tools?.length ? buildResponseFormat(request.outputType) : undefined

  return { messages, tools, responseFormat }
}

/**
 * 参考 openai-sdk 的 getResponseFormat，兼容 ZodObject（序列化为 json_schema）的结构化输出。
 * 与 openai-sdk 不同的是：text 输出也保留 json_object，因为平台 Agent 的最终输出约定为 JSON。
 */
function buildResponseFormat(outputType: SerializedOutputType): any {
  if (outputType && typeof outputType === 'object' && outputType.type === 'json_schema') {
    return {
      type: 'json_schema',
      json_schema: {
        name: outputType.name,
        strict: outputType.strict,
        schema: outputType.schema,
      },
    }
  }
  return { type: 'json_object' }
}

function itemToChatMessage(item: any): any {
  if (item.type === 'function_call') {
    return {
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: item.callId,
        type: 'function',
        function: { name: item.name, arguments: item.arguments },
      }],
    }
  }
  if (item.type === 'function_call_result') {
    return { role: 'tool', tool_call_id: item.callId, content: itemText(item.output) }
  }
  if (item.role === 'user' || item.role === 'assistant' || item.role === 'system' || item.type === 'message') {
    return { role: item.role, content: itemText(item.content) }
  }
  return undefined
}

function itemText(content: any): string {
  if (content === null || content === undefined) {
    return ''
  }
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content.map((part: any) => itemText(part)).join('')
  }
  if (typeof content === 'object') {
    if (typeof content.text === 'string') {
      return content.text
    }
    if (typeof content.output === 'string') {
      return content.output
    }
    if (typeof content.error === 'string') {
      return content.error
    }
    return JSON.stringify(content)
  }
  return String(content)
}

function sanitizeSchema(schema: any): Record<string, any> {
  if (!schema || typeof schema !== 'object') {
    return schema
  }
  const { $schema, ...rest } = schema
  return rest
}

async function accumulateStream(stream: any): Promise<{
  responseId: string
  usage: any
  text: string[]
  functionCalls: Array<{ id: string, callId: string, name: string, arguments: string }>
}> {
  let responseId = ''
  let usage: any
  const text: string[] = []
  const functionCalls: Array<{ id: string, callId: string, name: string, arguments: string }> = []

  for await (const chunk of stream) {
    if (chunk.id) {
      responseId = chunk.id
    }
    if (chunk.usage) {
      usage = chunk.usage
    }
    const delta = chunk.choices?.[0]?.delta
    if (!delta) {
      continue
    }
    if (delta.content) {
      text.push(delta.content)
    }
    for (const tc of delta.tool_calls ?? []) {
      const index = tc.index ?? 0
      if (!functionCalls[index]) {
        functionCalls[index] = { id: '', callId: '', name: '', arguments: '' }
      }
      if (tc.id) {
        functionCalls[index].callId = tc.id
      }
      if (tc.function?.name) {
        functionCalls[index].name += tc.function.name
      }
      if (tc.function?.arguments) {
        functionCalls[index].arguments += tc.function.arguments
      }
    }
  }

  return { responseId, usage, text, functionCalls }
}

function buildOutput(
  responseId: string,
  text: string,
  functionCalls: Array<{ callId: string, name: string, arguments: string }>,
): AgentOutputItem[] {
  const output: AgentOutputItem[] = []
  if (text) {
    output.push({
      id: responseId,
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text }],
    } as any)
  }
  for (const fc of functionCalls.filter(Boolean)) {
    output.push({
      id: responseId,
      type: 'function_call',
      callId: fc.callId || responseId,
      name: fc.name,
      arguments: fc.arguments,
      status: 'completed',
    } as any)
  }
  return output
}

export interface RunAgentOptions<TContext = unknown> {
  context?: TContext
  session?: Session
  maxTurns?: number | null
}

/** 非流式执行（SDK 内部负责 Agent Loop / Tool Calling / Session）。 */
export function runAgent<TContext, TAgent extends Agent<any, any>>(
  agent: TAgent,
  input: string,
  options: RunAgentOptions<TContext> = {},
): Promise<RunResult<TContext, TAgent>> {
  return agentsRun(agent, input, {
    context: options.context,
    session: options.session,
    maxTurns: options.maxTurns,
  })
}

/** 流式执行，并逐个抛出 SDK 的流式事件。 */
export async function runAgentStreamed<TContext, TAgent extends Agent<any, any>>(
  agent: TAgent,
  input: string | AgentInputItem[],
  options: RunAgentOptions<TContext> = {},
): Promise<StreamedRunResult<TContext, TAgent>> {
  return agentsRun(agent, input, {
    context: options.context,
    session: options.session,
    maxTurns: options.maxTurns,
    stream: true,
  })
}

export type { RunStreamEvent }
