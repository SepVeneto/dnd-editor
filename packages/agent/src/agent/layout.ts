import { Agent } from './Agent'
import { run } from './core/run'
import type { RunEvent } from './core/run'
import { parseJson } from './extract'
import { layoutIrSchema } from './ir'
import type { LayoutIR } from './ir'

export interface LayoutWidgetDescriptor {
  typeId: string
  description: string
  layout?: Record<string, any>
}

const LAYOUT_INSTRUCTIONS = `
你是布局 IR 生成器。根据标准化元素和可用组件生成 Layout IR。

输入格式：
{ "elements": [...], "widgets": [{ "typeId", "description", "layout" }, ...] }

输出是一个数组，每个元素表示一个组件及其承载的元素：
[
  { "widget": "组件 typeId", "items": [{ "category": "元素分类", "id": 元素索引 }] }
]

硬性要求：
1. 组件 typeId 必须从 widgets 里原样选取，不得编造。
2. 元素数据必须来自 elements，不得自行编造、补充或合并。
3. 布局策略：少量元素优先低密度、大面积、一个元素一个组件；元素较多时才考虑高密度组件分组。
4. 组件能否承载多个元素只表示能力，不表示必须合并。
5. 当多个组件都满足需求时，优先选择能带来更大视觉面积、更舒展的方案。
`

export function createLayoutAgent(): Agent<any, any> {
  return new Agent({
    name: 'layout',
    handoffDescription: '根据标准化元素与可用组件生成 Layout IR。',
    instructions: LAYOUT_INSTRUCTIONS,
    outputType: layoutIrSchema,
  })
}

export interface GenerateLayoutIROptions {
  elements: unknown
  widgets: LayoutWidgetDescriptor[]
  onEvent?: (event: RunEvent) => void
}

export async function generateLayoutIR(options: GenerateLayoutIROptions): Promise<LayoutIR> {
  const agent = createLayoutAgent()
  const input = JSON.stringify({ elements: options.elements, widgets: options.widgets })
  const result = await run(agent, input, { onEvent: options.onEvent })

  const parsed = parseJson(result.text)
  return Array.isArray(parsed) ? parsed as LayoutIR : []
}
