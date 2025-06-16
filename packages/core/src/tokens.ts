import type { InjectionKey } from 'vue'
import type { EventEmitter } from './helper'
import type { Node } from '@/class'

export interface EditorContext {
  node?: Node
  plugins?: any
  bus: EventEmitter
}

// 会分别导入，不能使用symbol
export const editorContextKey: InjectionKey<EditorContext> = '$_EDITOR' as unknown as symbol
