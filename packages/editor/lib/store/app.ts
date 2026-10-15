import type { IWidget } from '@sepveneto/dnde-core'
import { widgetType } from '@sepveneto/dnde-core'
import { Node, Widget } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { useEditor } from './editor'

export interface WidgetGroup { name: string, list: Widget[] }
export type LikeWidget = IWidget | { name: string, list: IWidget[], type: widgetType }

export const useApp = defineStore('app', () => {
  const widgets = shallowRef<(Widget | WidgetGroup)[]>()
  const widgetMap = new Map<string, Widget>()
  /** 编辑器文档是否已经按业务侧配置初始化：初始化之后 widgets 变化不再重建根节点 */
  let rootInitialized = false

  function setWidgets(data: LikeWidget[]) {
    widgets.value = []

    data.forEach((widget: LikeWidget) => {
      if (isGroup(widget)) {
        widgets.value?.push({ name: widget.name, list: widget.list.map(applyWidget) })
      }
      else {
        widgets.value?.push(applyWidget(widget))
      }
    })

    if (!rootInitialized && widgetMap.has('page')) {
      const editor = useEditor()
      const widget = widgetMap.get('page')!
      editor.setRoot(new Node(
        widget,
        JSON.parse(JSON.stringify({ props: widget.defaultData, style: widget.defaultStyle })),
      ))
      rootInitialized = true
    }
  }

  /**
   * 取同一个组件视图的定义实例。
   *
   * 业务侧（含开发态热更新）会反复下发组件配置，这里就地覆盖已有实例的配置：
   * 画布上的节点持有的是同一个 Widget 实例，因此改 schema 之后配置面板立刻用上新定义，
   * 也不会因为重建实例而丢失正在编辑的数据。
   */
  function applyWidget(widget: IWidget) {
    const exist = widgetMap.get(widget._view)
    if (!exist) {
      const inst = new Widget(widget)
      widgetMap.set(inst.view, inst)
      return inst
    }
    Object.assign(exist, new Widget(widget))
    return exist
  }

  function isGroup(data: LikeWidget & { type?: widgetType }): data is { name: string, list: IWidget[], type: widgetType } {
    return data.type === widgetType.GROUP
  }

  return {
    setWidgets,
    widgets,
    widgetMap,
  }
})
