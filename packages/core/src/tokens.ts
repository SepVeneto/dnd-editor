import type { InjectionKey } from 'vue'
import type { Node } from '@/class'

// 会分别导入，不能使用symbol
export const EditorContext: InjectionKey<{
  node?: Node
  plugins?: any
}> = '$_EDITOR' as unknown as symbol
