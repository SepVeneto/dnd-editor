import type { Node } from '@/class'
import { defineStore } from 'pinia'
import { ref, shallowRef, triggerRef } from 'vue'

export const useEditor = defineStore('editor', () => {
  const isPreview = ref(false)
  const nodeMap = new Map<string, Node>()
  const nodeList = shallowRef<Node[]>([])
  const selected = ref<string>()

  function addNode(node: Node) {
    nodeMap.set(node.wid, node)
    nodeList.value.push(node)
    refresh()
  }
  function refresh() {
    triggerRef(nodeList)
  }

  return {
    selected,
    addNode,
    refresh,
    nodeList,
    isPreview,
  }
})
