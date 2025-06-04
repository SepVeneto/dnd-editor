import type { Node } from '@sepveneto/dnde-core/class'
import { RootNode } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'

export const useEditor = defineStore('editor', () => {
  const shadowRoot = shallowRef<ShadowRoot>()
  const isPreview = ref(false)
  const nodeMap = new Map<string, Node>()
  const selected = ref<string>()
  const dragging = ref<Node>()
  const rootNode = new RootNode()
  const plugins = {
    helper: [],
  }
  const selectedNode = computed(() => {
    if (!selected.value)
      return

    return nodeMap.get(selected.value)
  })
  const selectedNodes = computed(() => {
    if (!selectedNode.value)
      return []

    let current: Node | undefined = selectedNode.value
    const pathNodes = []
    while (current) {
      pathNodes.push(current)
      current = current.parent
    }
    return pathNodes
  })

  function addNode(node: Node, pNode: Node = rootNode, manual = false) {
    nodeMap.set(node.wid, node)
    node.parent = pNode
    manual && pNode.list.push(node)
  }
  function delNode(wid: string) {
    const node = nodeMap.get(wid)
    const index = node?.parent?.list.findIndex(item => item.wid === wid)
    if (index == null) {
      throw new Error(`找不到节点 ${wid}`)
    }
    node?.parent?.list.splice(index, 1)
    nodeMap.delete(wid)
    selected.value = undefined
  }

  return {
    rootNode,
    shadowRoot,
    selected,
    selectedNode,
    selectedNodes,
    addNode,
    delNode,
    // nodeList,
    isPreview,
    dragging,
    plugins,
  }
})
