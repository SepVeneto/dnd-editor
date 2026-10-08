import { Agent } from '@openai/agents'
import { getModel, runAgent } from './core/sdk'
import type { LayoutIR, NormalizedElements } from './ir'
import { parseJson } from './extract'

export interface LayoutWidgetDescriptor {
  typeId: string
  description: string
  layout?: Record<string, any>
}

const LAYOUT_INSTRUCTIONS = `
你是布局 IR 生成器。根据标准化元素和可用组件生成 Layout IR。

输入：
- elements: [{ "kind": "分类", "items": [{ "name": "元素名", "id": 元素在该分类下的序号 }] }]
- widgets: [{ "typeId", "description", "layout" }]

只输出一个 JSON 对象：
{ "layout": [{ "widget": "组件 typeId", "items": [{ "category": "元素的 kind", "id": 元素的 id }] }] }

硬性要求：
1. 必须覆盖 elements 中的所有元素，不得遗漏、合并或编造。
2. category 取元素的 kind，id 取元素自身的 id，一一对应。
3. 组件 typeId 必须从 widgets 里原样选取。
4. 少量元素优先低密度、大面积、一个元素一个组件；元素较多时才考虑高密度组件分组。
`

export function createLayoutAgent(): Agent<any, any> {
  return new Agent({
    name: 'layout',
    model: getModel(),
    handoffDescription: '根据标准化元素与可用组件生成 Layout IR。',
    instructions: LAYOUT_INSTRUCTIONS,
  })
}

export interface GenerateLayoutIROptions {
  elements: NormalizedElements
  widgets: LayoutWidgetDescriptor[]
}

export async function generateLayoutIR(options: GenerateLayoutIROptions): Promise<LayoutIR> {
  const agent = createLayoutAgent()
  const input = JSON.stringify({ elements: options.elements, widgets: options.widgets })
  const result = await runAgent(agent, input)

  const output = parseJson(String(result.finalOutput ?? '')) as { layout?: unknown } | undefined
  return Array.isArray(output?.layout) ? output.layout as LayoutIR : []
}
