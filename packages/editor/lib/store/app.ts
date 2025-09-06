import type { IWidget } from '@sepveneto/dnde-core'
import { widgetType } from '@sepveneto/dnde-core'
import { Widget } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export interface WidgetGroup { name: string, list: Widget[] }
type LikeWidget = IWidget | { name: string, list: IWidget[], type: widgetType }

export const useApp = defineStore('app', () => {
  const widgets = shallowRef<(Widget | WidgetGroup)[]>()
  const widgetMap = new Map<string, Widget>()

  function setWidgets(data: LikeWidget[]) {
    widgets.value = []

    data.forEach((widget: LikeWidget) => {
      if (isGroup(widget)) {
        const group: Widget[] = []
        widget.list.forEach((item) => {
          const inst = new Widget(item)
          widgetMap.set(inst.view, inst)
          group.push(inst)
          widgets.value?.push({ name: widget.name, list: group })
        })
      }
      else {
        const inst = new Widget(widget)
        widgetMap.set(inst.view, inst)
        widgets.value?.push(inst)
      }
    })
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
