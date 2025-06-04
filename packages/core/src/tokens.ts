import type { InjectionKey, Reactive } from 'vue'
import type { Node } from '@/class'

export const EditorContext: InjectionKey<Reactive<{
  node?: Node
}>> = Symbol('editor')
