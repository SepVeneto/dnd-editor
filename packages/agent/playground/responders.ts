import type { MessagePart, ThreadMessage } from '@/agent/type'

/**
 * Playground 里的模型接入点是「可替换的 responder」：
 * - mock 直接把预置的回复「流式」吐出来，离线也能跑，方便调 UI；
 * - openai 走 OpenAI 兼容的 /chat/completions，用来验证真实链路。
 *
 * Agent 运行时自己的 model.ts 还在施工中，这里刻意不去依赖它，
 * 这样 playground 始终可用。
 */

export interface ModelConfig {
  baseURL: string
  apiKey: string
  model: string
}

export interface RespondContext {
  signal: AbortSignal
  config: ModelConfig
  history: ThreadMessage[]
}

export type RespondEvent
  = | { type: 'text-delta', text: string }
    | { type: 'part', part: MessagePart }

export type Responder = (input: string, ctx: RespondContext) => AsyncIterable<RespondEvent>

export const defaultModelConfig: ModelConfig = {
  baseURL: 'https://llm-29a9b93te5uwccoz.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
  apiKey: '',
  model: 'qwen-plus',
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException('aborted', 'AbortError'))

    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}

function* chunkText(text: string, size = 3): Generator<string> {
  for (let i = 0; i < text.length; i += size)
    yield text.slice(i, i + size)
}

interface MockReply {
  text: string
  parts?: MessagePart[]
}

function pickReply(input: string): MockReply {
  if (/卡券|优惠券|coupon|券/.test(input)) {
    return {
      text: '「卖卡券的那块」会先解析成具体的组件实例，再交给 layout.move 执行；这里用一条假数据演示 Action 的渲染。',
      parts: [
        {
          type: 'action',
          action: { capability: 'layout.move', args: { target: 'coupon@a1', before: 'goods-list' } },
        },
      ],
    }
  }

  if (/工具|tool|查询|数据源|接口/.test(input)) {
    return {
      text: '这个需求得先查一次外部数据，拿到结果之后再决定后面的编辑动作。',
      parts: [
        {
          type: 'tool-call',
          call: { name: 'coupon.query', args: { shopId: 's_1024' } },
        },
      ],
    }
  }

  if (/布局|生成|入口|首页/.test(input)) {
    return {
      text: '先按「两个入口」召回候选布局，split-entry 的约束更匹配：横向并列、图片型展示。',
      parts: [
        {
          type: 'action',
          action: { capability: 'layout.insert', args: { pattern: 'split-entry', widgets: ['A 卡券', 'B 场景'] } },
        },
      ],
    }
  }

  return {
    text: `Playground 收到了：${input}。\n当前是 Mock 模式，右侧「模型」面板可以切到真实模型；换成 /卡券、/工具、/布局 这类关键词能看到不同类型的 message part。`,
  }
}

export function createMockResponder(): Responder {
  return async function* mockResponder(input, { signal }) {
    yield {
      type: 'part',
      part: {
        type: 'raw',
        text: JSON.stringify({ responder: 'mock', input }, null, 2),
        label: 'mock/request',
      },
    }

    const reply = pickReply(input)

    for (const chunk of chunkText(reply.text)) {
      await sleep(16, signal)
      yield { type: 'text-delta', text: chunk }
    }

    for (const part of reply.parts ?? []) {
      await sleep(160, signal)
      yield { type: 'part', part: withMockResult(part) }
    }
  }
}

function withMockResult(part: MessagePart): MessagePart {
  if (part.type === 'action') {
    return { ...part, result: { ok: true, message: 'mock: 已执行' } }
  }

  if (part.type === 'tool-call') {
    return { ...part, result: { ok: true, message: 'mock: 返回 2 条记录' } }
  }

  return part
}

export function createOpenAIResponder(): Responder {
  return async function* openAIResponder(input, { signal, config, history }) {
    const base = config.baseURL.replace(/\/+$/, '')

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        stream: true,
        messages: toChatMessages(history, input),
      }),
      signal,
    })

    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      throw new Error(`模型请求失败：HTTP ${response.status} ${detail}`.trim())
    }

    yield {
      type: 'part',
      part: {
        type: 'raw',
        text: JSON.stringify({ url: `${base}/chat/completions`, model: config.model }, null, 2),
        label: 'request',
      },
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:'))
          continue

        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]')
          continue

        let json: any
        try {
          json = JSON.parse(payload)
        }
        catch {
          continue
        }

        const delta = json?.choices?.[0]?.delta
        if (!delta)
          continue

        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content)
          yield { type: 'part', part: { type: 'raw', text: delta.reasoning_content, label: 'reasoning' } }

        if (typeof delta.content === 'string' && delta.content)
          yield { type: 'text-delta', text: delta.content }
      }
    }
  }
}

function toChatMessages(history: ThreadMessage[], input: string) {
  const messages = history
    .map((message) => {
      const text = message.parts
        .filter(part => part.type === 'text')
        .map(part => (part as { text: string }).text)
        .join('\n')

      return {
        role: message.role === 'user' ? 'user' : 'assistant',
        content: text,
      }
    })
    .filter(message => message.content)

  if (!messages.length || messages[messages.length - 1].content !== input)
    messages.push({ role: 'user', content: input })

  return messages
}
