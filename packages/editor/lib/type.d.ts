import type { Node } from '@sepveneto/dnde-core/class'
import type { Reactive } from 'vue'

export interface DraggableEvt { oldDraggableIndex: number, oldIndex: number, newIndex: number, newDraggableIndex: number }

export interface HelperAction {
  title: string
  name: string
  action?: (node: Reactive<Node>) => void
  condition?: (node: Reactive<Node>) => boolean
}
