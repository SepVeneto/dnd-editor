import { Agent } from '@openai/agents'
import { z } from 'zod'
import { getModel, runAgent } from './core/sdk'

export interface StructuredExtractOptions {
  instructions: string
  schema: z.ZodType
  input: string
}

export async function structuredExtract(options: StructuredExtractOptions): Promise<unknown> {
  const agent = new Agent({
    name: 'structured-extract',
    model: getModel(),
    instructions: buildExtractInstructions(options),
  })

  const result = await runAgent(agent, options.input)
  return parseJson(String(result.finalOutput ?? ''))
}

function buildExtractInstructions(options: StructuredExtractOptions): string {
  const example = schemaToExample(options.schema)
  return [
    options.instructions,
    example ? `输出 JSON，结构示例（值请替换为真实数据）：\n${example}` : '',
    '只输出 JSON，不要输出任何其它文字。',
  ].filter(Boolean).join('\n\n')
}

function schemaToExample(schema: z.ZodType): string {
  try {
    const json = (schema as any).toJSONSchema?.()
    if (!json) {
      return ''
    }
    return JSON.stringify(jsonSchemaToExample(json))
  }
  catch {
    return ''
  }
}

function jsonSchemaToExample(node: any): any {
  if (!node || typeof node !== 'object') {
    return '字符串'
  }
  let type = node.type
  if (Array.isArray(type)) {
    type = type[0]
  }
  if (node.enum) {
    return node.enum[0]
  }
  if (type === 'object') {
    const out: Record<string, any> = {}
    for (const [key, value] of Object.entries(node.properties ?? {})) {
      out[key] = jsonSchemaToExample(value)
    }
    return out
  }
  if (type === 'array') {
    return [jsonSchemaToExample(node.items)]
  }
  if (type === 'number' || type === 'integer') {
    return 0
  }
  if (type === 'boolean') {
    return true
  }
  return '字符串'
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
