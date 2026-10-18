import type { Node, Widget } from '@sepveneto/dnde-core'
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

export interface LayoutContextNode {
  uuid: string
  name: string
  type: string
  desc?: string
  parent?: string
  children?: string[]

  // TODO: 要由业务侧提供
  // 从业务数据中提取的少量语义线索
  summary?: string

  // TODO: 要由业务侧提供
  // 保留少量有助于识别节点的关键字段
  keyData?: Record<string, string | number | boolean | null>
}

/**
 * 把页面组件树投影成扁平的状态 IR。
 *
 * 输出按先序遍历排列，节点之间通过 uuid 建立 parent / children 引用，
 * 避免把整棵树重复嵌套进模型上下文。`widgets` 用于在节点缺少
 * Widget 实例时，按组件类型回退解析展示名称。
 */
export function genStateIr(node: Node): LayoutContextNode[] {
  const result: LayoutContextNode[] = []

  const visit = (current: Node, parent: string | undefined) => {
    const uuid = current.wid
    const type = current.type
    const name = current.name
    const desc = current.widget.agent?.description
    const children = Array.isArray(current.list) ? current.list : []

    const item: LayoutContextNode = {
      uuid,
      name,
      type,
      desc,
    }
    if (parent) {
      item.parent = parent
    }
    if (children.length > 0) {
      item.children = children.map(child => child.wid)
    }

    result.push(item)
    children.forEach(child => visit(child, uuid))
  }

  visit(node, undefined)
  return result
}

export function genWidgetIr(widgets: Widget[]) {
  return widgets.map(item => ({
    type: item.view,
    attribues: item.props,
  }))
}
