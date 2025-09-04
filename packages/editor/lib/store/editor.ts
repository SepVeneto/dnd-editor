import type { IWidget } from '@sepveneto/dnde-core'
import type { Raw } from 'vue'
import type { HelperAction } from '@/type'
import { Node, Widget } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { computed, customRef, reactive, ref, shallowRef } from 'vue'
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

interface PanelInfo {
  label: string
  name: string
}
class WidgetPlugin {
  public list: PanelInfo[] = []
  constructor(_ctx: any) {

  }

  addPanel(panel: PanelInfo) {
    this.list.push(panel)
  }
}

export const useEditor = defineStore('editor', () => {
  const app = useApp()

  const shadowRoot = shallowRef<ShadowRoot>()
  const elementRoot = shallowRef<HTMLElement>()
  const isPreview = ref(false)
  const dragging = customRef<Node | null>((track, trigger) => {
    let draggingNode: Node | null
    return {
      get() {
        track()
        return draggingNode
      },
      set(node) {
        if (node) {
          draggingNode = node
          draggingNode.dragging = true
        }
        else {
          draggingNode!.dragging = false
          draggingNode = null
        }
        trigger()
      },
    }
  })
  const defaultPage: IWidget = app.widgetMap.get('page') || {
    name: '页面',
    view: 'page',
    schema: [],
  }
  // 防止类型实例化过于深并且可能无限错误
  const rootNode = reactive<Raw<Node>>(new Node(new Widget(defaultPage)))
  const selected = ref<string>(rootNode.wid)
  // TODO: hover栈
  const hovering = ref<string>()
  const nodeMap = new Map<string, Node>()
  nodeMap.set(rootNode.wid, rootNode)

  const plugins = {
    helper: new HelperPlugin({ addNode, delNode }),
    widget: new WidgetPlugin({ addPanel }),
  }
  const selectedNode = computed(() => {
    const node = nodeMap.get(selected.value)
    if (!node) {
      throw new Error('cannot find node')
    }
    return node
  })
  const selectedNodes = computed(() => {
    let current: Node | undefined = selectedNode.value
    const pathNodes: Node[] = []
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

  function addPanel() {

  }

  function addNode(node: Node, pNode: Node = rootNode as Node, manual = false) {
    node.level = pNode.level + 1
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

  function setData(data: any[], parent = rootNode as Node) {
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
      addNode(node, parent, true)
    })
  }

  function setSchema(schema: IWidget['schema']) {
    rootNode.widget._data.schema = schema
  }

  return {
    rootNode,
    shadowRoot,
    elementRoot,
    selectNode,
    selected,
    hovering,
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
    setSchema,
  }
})
