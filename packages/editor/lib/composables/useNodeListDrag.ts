import type { DraggableEvt } from '@/type'
import type { Node } from '@sepveneto/dnde-core/class'
import type { DragHost, DragTarget } from './dragCore'
import { nextTick } from 'vue'
import { useEditor } from '@/store'
import { handleNodeAdd, handleNodeInput } from './dragCore'

export type NodeListDragTarget = DragTarget

/**
 * 编辑区与大纲面板中所有可拖拽列表共用的拖拽处理。
 *
 * 逻辑本体在 `./dragCore`（不依赖 store / vue，便于单测），
 * 这里只负责取 store 并接线。
 */
export function useNodeListDrag(target: NodeListDragTarget) {
  const editor = useEditor()

  function onStart(evt: DraggableEvt) {
    const nodeId = evt.item.dataset.id
    editor.dragging = target.list.find(node => node.wid === nodeId) ?? null
  }

  function onAdd(evt: DraggableEvt) {
    handleNodeAdd(target, evt, {
      restoreToContainer: (containerId, index, node) => {
        const oldContainer = editor.nodeMap.get(containerId)
        // Node 是递归类型，直接调用 splice 会触发 TS2589，需要断言为 Node[]
        if (oldContainer) {
          ;(oldContainer.list as Node[]).splice(index, 0, node)
        }
      },
      addNode: (node, parent) => editor.addNode(node, parent),
    })
  }

  function onInput(val: Node[]) {
    handleNodeInput(target, val, fn => nextTick().then(fn))
  }

  return { onStart, onAdd, onInput }
}
