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

  function setWidgets(data: LikeWidget[]) {
    widgets.value = []

    data.forEach((widget: LikeWidget) => {
      if (isGroup(widget)) {
        widgets.value?.push({ name: widget.name, list: widget.list.map((item) => {
          const inst = new Widget(item)
          widgetMap.set(inst.view, inst)
          return inst
        }) })
      }
      else {
        const inst = new Widget(widget)
        widgetMap.set(inst.view, inst)
        widgets.value?.push(inst)
      }
    })

    if (widgetMap.has('page')) {
      const editor = useEditor()
      const widget = widgetMap.get('page')!
      editor.rootNode = new Node(
        widget,
        JSON.parse(JSON.stringify({ props: widget.defaultData, style: widget.defaultStyle })),
      )
    }
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
