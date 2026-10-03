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
 * - function-call：模型请求调用某个工具
 * - completed：这一轮结束，带回 response.id 用于下一轮续跑
 */
export type ModelStreamEvent
  = | { type: 'text-delta', text: string }
    | { type: 'function-call', callId: string, name: string, args: string }
    | { type: 'completed', responseId: string }

/** 单轮模型的输入：用户原文，或上一轮工具结果 */
export type ModelInput = string | Array<Record<string, unknown>>

function getInputItems(input: ModelRequest['input']) {
  if (typeof input === 'string') {
    return [
      { role: 'user', content: input }
    ]
  }

  throw new Error('TODO')
}

export async function getResponse(agent: Agent, input: any) {
  const result = await client.chat.completions.create({
    model: 'qwen-plus',
    messages: input,
    temperature: 0.1,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'json',
        strict: true,
        schema: (agent.outputType as any).toJSONSchema?.() ?? agent.outputType,
      }
    }
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
  input: ModelInput,
  previousResponseId?: string,
): AsyncGenerator<ModelStreamEvent> {
  const result = await client.responses.create({
    model: 'qwen-plus',
    instructions: agent.instructions,
    input: input as any,
    temperature: 0.1,
    previous_response_id: previousResponseId,
    stream: true,
    tools: agent.tools.map(item => {
      const { invoke, ...rest } = item
      return { ...rest, strict: false }
    }),
  })

  const seenCallIds = new Set<string>()

  for await (const event of result) {
    switch (event.type) {
      case 'response.output_text.delta':
        yield { type: 'text-delta', text: event.delta }
        break
      case 'response.output_item.done':
        if (event.item.type === 'function_call') {
          seenCallIds.add(event.item.call_id)
          yield {
            type: 'function-call',
            callId: event.item.call_id,
            name: event.item.name,
            args: event.item.arguments,
          }
        }
        break
      case 'response.completed': {
        // 有些 OpenAI 兼容实现不会单独推送 output_item.done，
        // 只在最终 response 里带上 function_call，这里兜底补一次。
        for (const item of event.response.output ?? []) {
          if (item.type === 'function_call' && !seenCallIds.has(item.call_id)) {
            seenCallIds.add(item.call_id)
            yield {
              type: 'function-call',
              callId: item.call_id,
              name: item.name,
              args: item.arguments,
            }
          }
        }
        yield { type: 'completed', responseId: event.response.id }
        break
      }
    }
  }
}
