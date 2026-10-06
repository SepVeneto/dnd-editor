import OpenAI from 'openai'
import type { Agent } from '../Agent'

const client = new OpenAI({
  baseURL: 'http://localhost:4000/v1',
  apiKey: 'test',
  dangerouslyAllowBrowser: true,
})


export type ModelRequest = {
  input: string
}

export type ModelResponse = {
  output: unknown[]
}

export type Model = {
  getResponse(request: ModelRequest): Promise<ModelResponse>

  getStreamedResponse(request: ModelRequest): AsyncIterable<unknown>
}

/**
 * 模型每一轮吐出的内容：
 * - text-delta：普通文本增量
 * - function-call：模型请求调用某个工具（arguments 为 JSON 字符串）
 */
export type ModelStreamEvent
  = | { type: 'text-delta', text: string }
    | { type: 'function-call', callId: string, name: string, args: string }

/** Chat Completions 的消息结构 */
export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string, arguments: string }
  }>
  tool_call_id?: string
}

function getInputItems(input: ModelRequest['input']) {
  if (typeof input === 'string') {
    return [
      { role: 'user', content: input }
    ]
  }

  throw new Error('TODO')
}

/** 把 agent 的 outputType 转成 chat 的 response_format；'text' 返回 undefined */
function buildResponseFormat(agent: Agent<any, any>) {
  const outputType = agent.outputType
  if (!outputType || outputType === 'text') {
    return undefined
  }

  const schema = typeof (outputType as any)?.toJSONSchema === 'function'
    ? (outputType as any).toJSONSchema()
    : outputType

  return {
    type: 'json_schema' as const,
    json_schema: {
      name: 'json',
      strict: true,
      schema,
    },
  }
}

export async function getResponse(agent: Agent, input: any) {
  const responseFormat = buildResponseFormat(agent)

  const result = await client.chat.completions.create({
    model: 'qwen-plus',
    messages: input,
    temperature: 0.1,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  })

  console.log(result)

  const content = result.choices[0].message.content
  if (!content) {
    return ''
  }
  return JSON.parse(content)
}

export async function* getStreamedResponse(
  agent: Agent<any, any>,
  messages: ChatMessage[],
): AsyncGenerator<ModelStreamEvent> {
  const responseFormat = buildResponseFormat(agent)

  const result = await client.chat.completions.create({
    model: 'qwen-plus',
    messages: messages as any,
    temperature: 0.1,
    stream: true,
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...(agent.tools.length
      ? {
          tools: agent.tools.map(item => ({
            type: 'function',
            function: {
              name: item.name,
              description: item.description,
              parameters: item.parameters,
            },
          })),
        }
      : {}),
  })

  // 流式 tool_calls 按 index 分片返回，这里先累积再统一抛出
  const pending = new Map<number, { id: string, name: string, args: string }>()

  for await (const chunk of result) {
    const delta = chunk.choices[0]?.delta
    if (!delta) {
      continue
    }

    if (delta.content) {
      yield { type: 'text-delta', text: delta.content }
    }

    for (const call of delta.tool_calls ?? []) {
      const index = call.index ?? 0
      const current = pending.get(index) ?? { id: '', name: '', args: '' }
      if (call.id) {
        current.id = call.id
      }
      if (call.function?.name) {
        current.name = call.function.name
      }
      if (call.function?.arguments) {
        current.args += call.function.arguments
      }
      pending.set(index, current)
    }
  }

  for (const call of pending.values()) {
    yield { type: 'function-call', callId: call.id, name: call.name, args: call.args }
  }
}
