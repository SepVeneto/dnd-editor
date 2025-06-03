import type { Node } from '@/class'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'
import { RootNode } from '@/class'

export const useEditor = defineStore('editor', () => {
  const shadowRoot = shallowRef<ShadowRoot>()
  const isPreview = ref(false)
  const nodeMap = new Map<string, Node>()
  const nodeList = ref<Node[]>([])
  const selected = ref<string>()
  const dragging = ref<Node>()
  const rootNode = new RootNode()
  const plugins: any[] = []
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

  function addNode(node: Node, pNode: Node = rootNode) {
    nodeMap.set(node.wid, node)
    node.parent = pNode
  }
  function refresh() {
    triggerRef(nodeList)
  }

  function register(plugin: any) {
    plugins.push(plugin)
  }

  return {
    shadowRoot,
    register,
    selected,
    selectedNode,
    selectedNodes,
    addNode,
    refresh,
    nodeList,
    isPreview,
    dragging,
    plugins,
  }
})
