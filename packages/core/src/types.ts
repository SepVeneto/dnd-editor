import type { FormItemRule, UploadRequestOptions } from 'element-plus'
import type { CSSProperties } from 'vue'
import type { Node, SchemaItem } from './class'

// region Widget
export interface WidgetPos {
  x?: number
  y?: number
  width?: number
  height?: number
}

/** 布局子 Agent 的输出项：选中的组件 + 要放进去的元素 */
export interface WidgetLayoutItem {
  widget: string
  items: Array<{ category: string, id: any }>
}

export interface WidgetAgent {
  description: string
  layout?: {
    direction: 'row' | 'column',
    density: 'low' | 'medium' | 'high',
    priority: 'large'
  }
  /**
   * 布局子 Agent 结束、组件创建完成后，由业务侧决定数据如何更新到组件里。
   *
   * @param node 已创建的组件节点
   * @param item 布局结果项（选中的组件 + 元素引用）
   * @param data 生成布局用到的业务数据
   */
  update?: (node: Node, item: WidgetLayoutItem, data: Record<string, any>) => void
}

export interface Base {
  _uuid?: string
  _name: string
  _view: string
  _icon?: string
  container?: boolean
  isShow?: boolean
  meta?: {
    draggable?: boolean
    visible?: boolean
    // 一般与draggable配合使用，达到类似header之类的效果
    fixed?: boolean | 'header' | 'footer'
  }
  schema?: {
    props?: SchemaItem[]
    style?: SchemaItem[]
  }
  style?: CSSProperties & WidgetPos
  data?: Record<string, any> | any[]

  agent?: WidgetAgent
}

type BaseKey
  = '_inContainer'
    | '_custom'
    | '_disableDel'
    | '_name'
    | '_schema'
    | '_uuid'
    | '_view'

export type IWidget = Base
// endregion

// region Schema
// type WidgetType =
//   'input'
//   | 'number'
//   | 'checkbox'
//   | 'image'
//   | 'colorPicker'
//   | 'select'
//   | 'radioGroup'
//   | 'editor'
//   | 'box'
//   | 'switch'
type BoxModel = 'marginLeft'
  | 'marginTop'
  | 'marginRight'
  | 'marginBottom'
  | 'paddingLeft'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'borderLeft'
  | 'borderTop'
  | 'borderBottom'
  | 'borderight'

type SchemaRule = FormItemRule

type ValidKey<T extends Base> = Exclude<keyof T, BaseKey> | `style.${string}` | 'isShow'

export type SchemaOther<T extends Base> = {
  [k in ValidKey<T>]: {
    type: string
    label?: string
    key: k
    tips?: string
    link?: Record<string, SchemaOther<T>[]>
    _inContainer?: 'outer' | 'inner'
    onChange?: (data: any) => void
    rules?: SchemaRule[]
    [other: string]: any
  }
}[ValidKey<T>]

export interface SchemaBox {
  type: 'box'
  _inContainer?: 'outer' | 'inner'
  include?: BoxModel[]
  exclude?: BoxModel[]
}

export type ISchema<T extends Base = any> = (SchemaOther<T> | SchemaBox)[]

export function isBox(schema: ISchema<any>[number]): schema is SchemaBox {
  return schema.type === 'box'
}

// endregion

// region Editor
export interface EditorConfig {
  version?: string
  globalConfig: Record<PropertyKey, unknown>
  body: Record<PropertyKey, unknown>
  tabbars?: Record<PropertyKey, unknown>
}
export interface EditorSchema {
  globalConfig?: SchemaOther<any>[]
  $pageConfig?: Record<string, SchemaOther<any>[]>
  tabbar?: { custom?: boolean }
  [other: string]: ISchema | undefined | { custom?: boolean } | SchemaOther<any>[]
}
export interface EditorWidget {
  _name: string
  _view: string
  _schema: string
  _inContainer?: 'outer' | 'inner'
  style?: Partial<CSSProperties>
  [key: string]: unknown
}
export interface EditorRoute {
  name: string
  path: string
  meta?: Record<PropertyKey, unknown> & { title?: string }
}
type DisabledRules = boolean | Partial<{
  delete: boolean
  custom: boolean
  sort: boolean
}>
export type DisabledItemFn = (widget: EditorWidget) => DisabledRules
export type EditorWidgets = {
  name: string
  group: EditorWidget[]
}[]

export interface EditorSettings {
  disabledItem?: DisabledItemFn
  disabledAdd?: boolean
}

export interface EditorData {
  upload?: (data: UploadRequestOptions) => Promise<string>
  /**
   * 组件视图的可访问地址
   */
  remoteUrl?: string
  /**
   * 编辑器数据
   */
  config: EditorConfig
  /**
   * 组件的配置项
   */
  schema?: EditorSchema
  /**
   * 可配置的组件列表
   */
  widgets?: {
    name: string
    group: EditorWidget[]
  }[]
  /**
   * 编辑器的路由
   */
  routes?: EditorRoute[]
  /**
   * 编辑器配置
   */
  settings?: EditorSettings
}
