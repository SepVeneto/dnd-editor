import type { InjectionKey } from 'vue'
import type { EventEmitter } from './helper'
import type { Node } from '@/class'

export interface EditorContext {
  node?: Node
  plugins?: any
  bus: EventEmitter
  extra: Record<string, any>
  /**
   * 是否处于预览态，预览态下业务组件应禁用拖拽、缩放等编辑交互
   */
  preview?: boolean
  /**
   * 业务组件在运行时修改自身配置后，通知编辑器同步数据 / 触发变更
   */
  updateConfig?: (data: any) => void
}

// 会分别导入，不能使用symbol
export const editorContextKey: InjectionKey<EditorContext> = '$_EDITOR' as unknown as symbol
