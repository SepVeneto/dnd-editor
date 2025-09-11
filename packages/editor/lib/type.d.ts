import type { Node } from '@sepveneto/dnde-core/class'

export interface DraggableEvt {
  to: HTMLElement
  from: HTMLElement
  oldDraggableIndex: number
  oldIndex: number
  newIndex: number
  newDraggableIndex: number
  item: HTMLElement
}

export interface HelperAction {
  title: string
  name: string
  action?: (node: Node) => void
  condition?: (node: Node) => boolean
}
