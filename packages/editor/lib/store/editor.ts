import type { IWidget } from '@sepveneto/dnde-core'
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import type { Rule } from 'async-validator'
import type { Raw } from 'vue'
import type { HelperAction } from '@/type'
import { widget } from '@sepveneto/dnde-core'
import { Node, Widget } from '@sepveneto/dnde-core/class'
import Validator from 'async-validator'
import { defineStore } from 'pinia'
import { computed, customRef, ref, shallowRef, watchEffect } from 'vue'
import { createDebug, removePopper } from '@/utils'
import { useApp } from './app'

const debug = createDebug('store/editor')

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

export interface PanelInfo {
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

export interface ConfigPanel {
  label: string
  name: string
  attributes: SchemaItem[]
}
class ConfigPlugin {
  public list: ConfigPanel[] = []
  constructor(_ctx?: any) {

  }

  get defaultPane() {
    if (!this.list.length)
      return ''

    return this.list[0].name
  }

  addPanel(panel: ConfigPanel) {
    this.list.push(panel)
  }

  async validate(data: any) {
    for (const pane of this.list) {
      if (!data[pane.name])
        continue

      const _rules = pane.attributes.reduce<Record<string, Rule>>((all, curr) => {
        all[curr.key] = curr.rules || []
        return all
      }, {}) || {}
      const valid = await new Validator(_rules).validate(data[pane.name]).catch(() => {
        return false
      })
      if (valid) {
        continue
      }
      return false
    }
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
  const defaultPage = app.widgetMap.get('page') as Widget || new Widget(widget.create({
    name: '页面',
    type: 'page',
    defaultData: { list: [] },
  }))
  // 防止类型实例化过于深并且可能无限错误
  const rootNode = ref<Raw<Node>>(new Node(defaultPage))
  // TODO: hover栈
  const hovering = ref<string>()
  const nodeMap = new Map<string, Node>()
  nodeMap.set(rootNode.value.wid, rootNode.value)
  const selected = ref<string>(rootNode.value.wid)

  watchEffect(() => {
    nodeMap.delete(rootNode.value.wid)
    selected.value = rootNode.value.wid
    nodeMap.set(rootNode.value.wid, rootNode.value)
  })

  const plugins = {
    helper: new HelperPlugin({ addNode, delNode }),
    widget: new WidgetPlugin({ addPanel }),
    config: new ConfigPlugin(),
  }
  const selectedNode = computed(() => {
    const node = nodeMap.get(selected.value)
    if (!node) {
      throw new Error('cannot find node')
    }
    debug('selected node', node)
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

  function addNode(node: Node, pNode: Node = rootNode.value as Node, manual = false) {
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
    selected.value = rootNode.value.wid
  }

  function selectNode(wid?: string) {
    selected.value = wid || rootNode.value.wid
  }

  function getData() {
    return rootNode.value.parse()
  }

  function createNodes(data: any[], parent = rootNode.value) {
    data.forEach((item) => {
      const widget = app.widgetMap.get(item._view) as Widget
      if (!widget)
        return

      const { _uuid, _name, _view, style, list, ...props } = item
      const info = {
        props,
        style,
        list: [],
      }
      const node = new Node(widget, info)
      addNode(node, parent, true)
      if (list && list.length > 0) {
        createNodes(list, node)
      }
    })
  }
  function setData(data: any) {
    const widget = app.widgetMap.get(data._view) as Widget || defaultPage

    const { _uuid, _name, _view, style, list, ...props } = data
    const info = {
      props,
      style,
      list: [],
    }
    rootNode.value = new Node(widget, info)

    nodeMap.delete(selected.value)
    selected.value = rootNode.value.wid
    nodeMap.set(rootNode.value.wid, rootNode.value)

    createNodes(list)
  }

  function setSchema(schema: IWidget['schema']) {
    rootNode.value.widget._data.schema = schema
  }

  return {
    rootNode,
    nodeMap,
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
