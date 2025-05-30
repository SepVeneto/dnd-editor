import type { IWidget } from '@sepveneto/dnde-core'
import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
import { Container, Widget } from '@/class'

export const useApp = defineStore('app', () => {
  const widgets = shallowRef<Widget[]>()
  function setWidgets(data: IWidget[]) {
    widgets.value = [
      new Container({ _name: '容器', _schema: 'container', _view: 'container', style: {}, isShow: 1 }),
      ...data.map(widget => new Widget(widget)),
    ]
  }

  return {
    setWidgets,
    widgets,
  }
})
