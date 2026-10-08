import { z } from 'zod'

export interface AddComponentIR {
  type: 'add-component'
  widget: string
  items: Array<Record<string, any>>
}

export interface DeleteComponentIR {
  type: 'delete-component'
  target: string
}

export interface UpdateComponentIR {
  type: 'update-component'
  target: string
  changes: Record<string, any>
}

export interface MoveComponentIR {
  type: 'move-component'
  target: string
  before?: string
  after?: string
}

export type EditIR = AddComponentIR | DeleteComponentIR | UpdateComponentIR | MoveComponentIR

export interface LayoutWidgetItem {
  widget: string
  items: Array<{ category: string, id: any }>
}

export type LayoutIR = LayoutWidgetItem[]

/** 标准化后的布局元素：业务数据统一成 { kind, items: [{ name, id }] }。 */
export interface NormalizedElementItem {
  name: string
  id: number
}

export interface NormalizedElement {
  kind: string
  items: NormalizedElementItem[]
}

export type NormalizedElements = NormalizedElement[]

// Agents SDK 的 outputType 只接受 ZodObject，因此用对象包一层数组。
export const layoutIrSchema = z.object({
  layout: z.array(
    z.object({
      widget: z.string().describe('组件类型'),
      items: z.array(
        z.object({
          category: z.string().describe('元素分类'),
          id: z.any().describe('元素索引'),
        }),
      ),
    }),
  ),
})

export const editIrSchema = z.object({
  edits: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('add-component'),
        widget: z.string(),
        items: z.array(z.any()),
      }),
      z.object({
        type: z.literal('delete-component'),
        target: z.string(),
      }),
      z.object({
        type: z.literal('update-component'),
        target: z.string(),
        changes: z.record(z.string(), z.any()),
      }),
      z.object({
        type: z.literal('move-component'),
        target: z.string(),
        before: z.string().optional(),
        after: z.string().optional(),
      }),
    ]),
  ),
})
