import type { AppContext, InjectionKey, VNode } from 'vue'
import type { Node } from './class'
import { loadRemote } from '@module-federation/enhanced/runtime'
import { ElTooltip } from 'element-plus'
import { createVNode, defineAsyncComponent, h, render } from 'vue'

export const EditorContext: InjectionKey<{ nodeList: Node[] }> = Symbol('editor')

export function loadFromRemote(scope: string, module: string) {
  const renderer = defineAsyncComponent({
    loader: () => loadRemote(`${scope}/${module}`) as any,
    loadingComponent: () => h('div', '加载中...'),
    onError(error, retry, fail) {
      console.error(error)
      fail()
    },
  })

  return renderer
}

type RemovePopperFn = (() => void) & {
  trigger?: HTMLElement
  vm?: VNode
}
// eslint-disable-next-line import/no-mutable-exports
export let removePopper: RemovePopperFn | null = null

export function createPopper(
  ctx: AppContext,
  trigger: HTMLElement,
  content: string,
  parent?: HTMLElement,
) {
  if (removePopper?.trigger === trigger) {
    return
  }
  removePopper?.()

  const vm = createVNode(ElTooltip, {
    virtualTriggering: true,
    virtualRef: trigger,
    appendTo: parent,
    // teleported: false,
    placement: 'top',
    transition: 'none',
    offset: 4,
    hideAfter: 0,
  }, { content: () => content })
  vm.appContext = ctx

  const container = document.createElement('div')
  render(vm, container)
  vm.component!.exposed!.onOpen()

  removePopper = () => {
    render(null, container)
    removePopper = null
  }

  removePopper.trigger = trigger
  removePopper.vm = vm
}
