/**
 * Agent 相关的轻量类型定义。
 *
 * 这些结构本来来自可选的 `@sepveneto/dnde-agent` 包，但编辑器不应当强依赖它
 * （业务侧可以不安装）。因此这里保留编辑器真正用到的字段做本地声明，
 * 运行时由 agent web component 通过事件/属性传回，结构保持一致即可。
 */

/** 供 Layout Agent 选取组件的描述信息。 */
export interface LayoutWidgetDescriptor {
  typeId: string
  description: string
  layout: Record<string, any>
}

/** Layout Agent 生成的一个组件片段。 */
export interface LayoutWidgetItem {
  widget: string
  items: Array<{ category: string, id: any }>
}

export type LayoutIR = LayoutWidgetItem[]

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

/** Edit Agent 生成的单条编辑指令。 */
export type EditIR = AddComponentIR | DeleteComponentIR | UpdateComponentIR | MoveComponentIR
