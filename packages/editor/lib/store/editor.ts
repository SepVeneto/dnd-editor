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
 * 每个标签绑定一个固定组件 Node，但组件数据和配置页都属于根节点：
 * - 数据写入 `rootNode.data[type]`，通过 `getData()` 输出，不进入页面拖拽列表；
 * - 配置项由该 Widget 的 `schema.props` 定义；
 * - 只有 `data.isShow` 为真时才渲染固定组件预览，纯配置标签不会加载组件视图；
 * - 点击固定组件预览时应回到根节点，并激活对应配置标签，而不是独立选中该组件。
 */
class ConfigPlugin {
  public list: Node[] = []

  constructor(public ctx: ConfigPluginContext) {}

  get defaultPane() {
    return this.list[0]?.wid ?? ''
  }

  /** 注册一个根节点配置标签及其固定组件视图 */
  addPanel(options: IWidget): Node {
    const instance = new Widget(options)
    const root = this.ctx.rootNode()
    const key = instance.view
    if (!root.data[key])
      root.data[key] = {}

    Object.assign(root.data[key], instance.defaultData ?? {})

    instance._data.meta = { ...instance._data.meta, draggable: false }
    // 组件默认数据并入同一份配置对象，响应式与 getData() 都能覆盖到
    const node = new Node(instance, {
      props: root.data[key],
      style: JSON.parse(JSON.stringify(instance.defaultStyle ?? {})),
    })
    // 注册进 nodeMap 以便通过 wid 定位/选中，但不进入页面拖拽列表（manual = false）
    this.ctx.addNode(node, root, false)

    this.list.push(node)
    return node
  }

  async validate() {
    for (const panel of this.list) {
      // 关联组件定义了显示开关且处于关闭状态时，不参与校验
      if (panel && CONFIG_PANEL_SHOW_KEY in panel.data && !panel.data[CONFIG_PANEL_SHOW_KEY])
        continue

      const items = (panel.widget.props ?? [])
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
  /** 当前配置标签，固定组件预览的选中态也跟随它。 */
  const activeConfigPane = ref<string>('props')

  const showTopbar = computed(() => {
    const topbar = rootNode.value.widget._data.schema?.props?.find((item) => {
      return item._role === 'topbar'
    })
    // 默认显示
    if (!topbar)
      return true

    return !!rootNode.value.data[topbar.key]
  })

  watchEffect(() => {
    nodeMap.delete(rootNode.value.wid)
    selected.value = rootNode.value.wid
    activeConfigPane.value = 'props'
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
    selectNode()
  }

  function selectNode(wid?: string) {
    selected.value = wid || rootNode.value.wid
    if (!wid || wid === rootNode.value.wid)
      activeConfigPane.value = 'props'
  }

  /** 选中根节点并激活指定配置页；固定组件视图本身不进入普通组件选中态。 */
  function selectConfigPane(wid: string) {
    if (!plugins.config.list.some(panel => panel.wid === wid))
      return

    selected.value = rootNode.value.wid
    activeConfigPane.value = wid
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
    activeConfigPane.value = 'props'
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
    selectConfigPane,
    selected,
    activeConfigPane,
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
