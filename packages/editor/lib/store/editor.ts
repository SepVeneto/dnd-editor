import type { Node } from '@sepveneto/dnde-core/class'
import type { HelperAction } from '@/type'
import { RootNode } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { removePopper } from '@/utils'

class HelperPlugin {
  public list: HelperAction[] = []
  // TODO: type
  constructor(ctx: any) {
    this.list = [
      {
        title: '复制',
        name: 'copy',
        action: (node) => {
          const newNode = node.copy()
          ctx.addNode(newNode, node.parent, true)
        },
      },
      {
        title: '删除',
        name: 'delete',
        action: (node) => {
          ctx.delNode(node.wid)
          removePopper?.()
        },
      },
    ]
  }

  addBuiltin(config: HelperAction) {
    const exist = this.list.filter(item => item.name === config.name)
    if (!exist.length) {
      this.list.unshift(config)
    }
    else {
      Object.assign(exist[0], config)
    }
  }
}

export const useEditor = defineStore('editor', () => {
  const shadowRoot = shallowRef<ShadowRoot>()
  const isPreview = ref(false)
  const nodeMap = new Map<string, Node>()
  const selected = ref<string>()
  const dragging = ref<Node>()
  const rootNode = new RootNode()
  const plugins = {
    helper: new HelperPlugin({ addNode, delNode }),
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
  const selectedNodeOperates = computed(() => {
    const node = selectedNode.value
    if (!node)
      return []

    return plugins.helper.list.filter(item => !item.condition || item.condition(node))
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
    selectedNodeOperates,
    addNode,
    delNode,
    // nodeList,
    isPreview,
    dragging,
    plugins,
  }
})
