import type { IWidget } from '@sepveneto/dnde-core'
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import type { Rule } from 'async-validator'
import type { Raw } from 'vue'
import type { HelperAction } from '@/type'
import { widget } from '@sepveneto/dnde-core'
import { Node, Widget } from '@sepveneto/dnde-core/class'
import Validator from 'async-validator'
import { v4 } from 'uuid'
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

/**
 * 组件固定显示字段的约定（业务侧自行定义开关，编辑器据此决定是否渲染预览）。
 * 与 `Node.visible` 使用同一约定：`data.isShow` 为真值时显示，为假值时隐藏。
 */
export const CONFIG_PANEL_SHOW_KEY = 'isShow'

export interface ConfigPluginContext {
  addNode: (node: Node, pNode?: Node, manual?: boolean) => void
  rootNode: () => Node
}
export interface ConfigPanelOptions {
  /** 标签显示名（默认取组件的名字或数据键） */
  label?: string
  /** 数据键：该标签的配置项绑定在 rootNode.data[name] 下 */
  name: string
  /** 根节点（页面级）配置项，由业务侧定义 */
  attributes?: SchemaItem[]
  /**
   * 可选：位置固定、组件区（widgets）不自由提供的组件（如浮窗）。
   * 提供时编辑器会以预览态渲染它，并可在选中后配置其内容；
   * 不提供则只是一个纯配置标签。
   */
  component?: IWidget
}
export interface ConfigPanel {
  /** 稳定的标识，用于标签定位 */
  wid: string
  label: string
  /** 数据键，配置项绑定在 rootNode.data[name] 下 */
  name: string
  /** 根节点（页面级）配置项 */
  attributes: SchemaItem[]
  /** 该标签绑定的数据对象 */
  data: Record<string, any>
  /** 可选的固定组件节点 */
  node?: Node
}
/**
 * 根节点（页面级）配置的补充入口（config pane 提供的额外标签）。
 *
 * 本质上只是给根节点配置区多加一个标签：标签里是业务侧定义的根配置项，
 * 用于补充根节点的配置。它**不一定是独立组件**——可能只是出于业务需要把一组配置单独归到一个标签里；
 * 「浮窗」这类位置固定、组件区不自由提供的组件，是当这些配置驱动一个固定组件时的用法之一。
 *
 * 若提供了 `component`，编辑器会额外把它作为独立 Node 绑定到根节点上（不进入页面布局的拖拽列表，
 * 因此不可拖曳、不可删除，始终以预览态渲染）；组件的两份配置相互独立、都由业务侧定义：
 * - 根配置（`attributes`）：本标签里的配置项；
 * - 组件内容（`component.schema.props`）：选中该组件后于「属性」里编辑。
 */
class ConfigPlugin {
  public list: ConfigPanel[] = []

  constructor(public ctx: ConfigPluginContext) {}

  get defaultPane() {
    return this.list[0]?.wid ?? ''
  }

  /** 注册一个根节点配置标签；`component` 可选，提供时会额外挂一个固定组件 */
  addPanel(options: ConfigPanelOptions): ConfigPanel {
    const root = this.ctx.rootNode()
    const name = options.name
    if (!root.data[name])
      root.data[name] = {}

    let node: Node | undefined
    if (options.component) {
      const instance = new Widget(options.component)
      instance._data.meta = { ...instance._data.meta, draggable: false }
      // 组件默认数据并入同一份配置对象，响应式与 getData() 都能覆盖到
      Object.assign(root.data[name], instance.defaultData ?? {})
      node = new Node(instance, {
        props: root.data[name],
        style: JSON.parse(JSON.stringify(instance.defaultStyle ?? {})),
      })
      // 注册进 nodeMap 以便通过 wid 定位/选中，但不进入页面拖拽列表（manual = false）
      this.ctx.addNode(node, root, false)
    }

    const panel: ConfigPanel = {
      wid: node?.wid ?? v4(),
      label: options.label ?? options.component?._name ?? name,
      name,
      attributes: options.attributes ?? [],
      data: root.data[name],
      node,
    }
    this.list.push(panel)
    return panel
  }

  async validate() {
    for (const panel of this.list) {
      // 关联组件定义了显示开关且处于关闭状态时，不参与校验
      if (panel.node && CONFIG_PANEL_SHOW_KEY in panel.data && !panel.data[CONFIG_PANEL_SHOW_KEY])
        continue

      const items = [...panel.attributes, ...(panel.node?.widget.props ?? [])]
      const _rules = items.reduce<Record<string, Rule>>((all, curr) => {
        all[curr.key] = curr.rules || []
        return all
      }, {}) || {}
      const valid = await new Validator(_rules).validate(panel.data || {}).catch(() => {
        return false
      })
      if (valid) {
        continue
      }
      return false
    }
    return true
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

  const showTopbar = computed(() => {
    const topbar = rootNode.value.widget._data.schema?.props?.find(item => {
      return item._role === 'topbar'
    })
    // 默认显示
    if (!topbar) return true

    return !!rootNode.value.data[topbar.key]
  })

  watchEffect(() => {
    nodeMap.delete(rootNode.value.wid)
    selected.value = rootNode.value.wid
    nodeMap.set(rootNode.value.wid, rootNode.value)
  })

  const plugins = {
    helper: new HelperPlugin({ addNode, delNode }),
    widget: new WidgetPlugin({ addPanel }),
    config: new ConfigPlugin({ addNode, rootNode: () => rootNode.value as Node }),
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
  /** 递归注销节点及其子树，避免被删除的节点残留在 nodeMap 中造成泄漏 */
  function unregister(node: Node) {
    nodeMap.delete(node.wid)
    node.list.forEach(item => unregister(item))
  }

  function delNode(wid: string) {
    const node = nodeMap.get(wid)
    const parent = node?.parent
    const index = parent?.list.findIndex(item => item.wid === wid) ?? -1
    // 根节点没有父级，不允许删除
    if (!node || !parent || index === -1) {
      throw new Error(`找不到节点 ${wid}`)
    }
    parent.list.splice(index, 1)
    unregister(node)
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

      const { _uuid, style, list, data } = item
      const info = {
        uuid: _uuid,
        props: data,
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
  /** 替换整棵文档树：先注销旧树，避免 rootNode 变更后旧节点滞留在 nodeMap 中 */
  function setRoot(node: Node) {
    unregister(rootNode.value)
    rootNode.value = node
    selected.value = node.wid
    nodeMap.set(node.wid, node)
  }

  function setData(data: any) {
    const widget = app.widgetMap.get(data._view) as Widget || defaultPage

    const { _uuid, style, list = [], data: props } = data
    const info = {
      uuid: _uuid,
      props,
      style,
      list: [],
    }
    setRoot(new Node(widget, info))

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
    setRoot,
    // nodeList,
    isPreview,
    dragging,
    plugins,
    showTopbar,

    getData,
    setData,
    setSchema,
  }
})
