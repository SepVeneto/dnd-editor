import type { Node } from '@sepveneto/dnde-core/class'

export interface DraggableEvt { oldDraggableIndex: number, oldIndex: number, newIndex: number, newDraggableIndex: number }

export interface HelperAction {
  title: string
  name: string
  action?: (node: Node) => void
  condition?: (node: Node) => boolean
}
