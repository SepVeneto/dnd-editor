import type { IWidget } from '@sepveneto/dnde-core'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { Widget } from '@/class'

export const useApp = defineStore('app', () => {
  const widgets = shallowRef<Widget[]>()
  function setWidgets(data: IWidget[]) {
    widgets.value = data.map(widget => new Widget(widget))
  }

  return {
    setWidgets,
    widgets,
  }
})
