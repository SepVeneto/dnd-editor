import type { IWidget } from '@sepveneto/dnde-core'
import { Widget } from '@sepveneto/dnde-core/class'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export const useApp = defineStore('app', () => {
  const widgets = shallowRef<Widget[]>()
  function setWidgets(data: IWidget[]) {
    widgets.value = [
      ...data.map(widget => new Widget(widget)),
    ]
  }

  return {
    setWidgets,
    widgets,
  }
})
