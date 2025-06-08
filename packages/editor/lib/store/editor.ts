import type { Widget } from '@sepveneto/dnde-core/class'
import type { Reactive } from 'vue'
import type { HelperAction } from '@/type'
import { Node, RootNode } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef } from 'vue'
import { removePopper } from '@/utils'
import { useApp } from './app'

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
  const dragging = ref<Node>()
  const rootNode = reactive(new RootNode())
  const selected = ref<string>(rootNode.wid)
  const nodeMap = new Map<string, Reactive<Node>>()
  nodeMap.set(rootNode.wid, rootNode)

  const plugins = {
    helper: new HelperPlugin({ addNode, delNode }),
  }
  const selectedNode = computed(() => {
    const node = nodeMap.get(selected.value)
    if (!node) {
      throw new Error('cannot find node')
    }
    return node
  })
  const selectedNodes = computed(() => {
    let current: Reactive<Node> | undefined = selectedNode.value
    const pathNodes: Reactive<Node>[] = []
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

  function addNode(node: Reactive<Node>, pNode: Reactive<Node> = rootNode, manual = false) {
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
    selected.value = rootNode.wid
  }

  function selectNode(wid?: string) {
    selected.value = wid || rootNode.wid
  }

  function getData() {
    return rootNode.parse()
  }

  const app = useApp()
  function setData(data: any[], parent = rootNode) {
    data.forEach((item) => {
      const widget = app.widgetMap.get(item._view) as Widget
      if (!widget)
        return

      const { _uuid, _name, _view, style, isShow, list, ...props } = item
      const info = {
        props,
        style,
        list: [],
      }
      const node = new Node(widget, info)
      addNode(reactive(node), parent, true)
    })
  }

  return {
    rootNode,
    shadowRoot,
    selectNode,
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

    getData,
    setData,
  }
})
