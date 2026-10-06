import { z } from 'zod'
import { Agent } from './Agent'
import { run } from './core/run'
import type { RunEvent } from './core/run'

export interface StructuredExtractOptions {
  /** 描述需要抽取的结构与字段含义（业务数据描述，不是 Agent 编排）。 */
  instructions: string
  schema: z.ZodType
  input: string
  onEvent?: (event: RunEvent) => void
}

/**
 * 平台提供的结构化抽取原语。
 *
 * 业务侧在 Workflow Step 中只需要给出 schema 与字段说明，
 * 不需要创建 Agent、维护 Prompt 或处理模型循环。
 */
export async function structuredExtract(options: StructuredExtractOptions): Promise<unknown> {
  const agent = new Agent({
    name: 'structured-extract',
    instructions: options.instructions,
    outputType: options.schema,
  })

  const result = await run(agent, options.input, { onEvent: options.onEvent })
  return parseJson(result.text)
}

export function parseJson(text: string): unknown {
  if (!text) {
    return undefined
  }

  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  }
  catch {
    const match = trimmed.match(/[\[{][\s\S]*[\]}]/)
    if (match) {
      try {
        return JSON.parse(match[0])
      }
      catch {
        return text
      }
    }
    return text
  }
}
