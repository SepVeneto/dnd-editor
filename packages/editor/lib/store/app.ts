import type { IWidget } from '@sepveneto/dnde-core'
import { Widget } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useApp = defineStore('app', () => {
  const widgets = shallowRef<Widget[]>()
  const widgetMap = new Map<string, Widget>()
  function setWidgets(data: IWidget[]) {
    widgets.value = []

    data.forEach((widget) => {
      const inst = new Widget(widget)
      widgetMap.set(inst.view, inst)
      widgets.value?.push(inst)
    })
  }

  return {
    setWidgets,
    widgets,
    widgetMap,
  }
})
