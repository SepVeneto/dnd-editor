import type { AppContext, CSSProperties, VNode } from 'vue'
import {
  WarningFilled as IconFailed,
  Loading as IconLoading,
} from '@element-plus/icons-vue'
import { loadRemote } from '@module-federation/enhanced/runtime'
import { ElIcon, ElTooltip } from 'element-plus'
import { createVNode, defineAsyncComponent, h, render } from 'vue'

export function loadFromRemote(scope: string, module: string) {
  const renderer = defineAsyncComponent({
    loader: () => loadRemote(`${scope}/${module}`) as any,
    loadingComponent: () => h(
      'div',
      { class: ['mpd-flex', 'mpd-flex-center', 'mpd-items-center', 'mpd-justify-center'] },
      h(ElIcon, { size: 24, style: { animation: 'loading-rotate 2s linear infinite' } }, () => h(IconLoading)),
    ),
    errorComponent: () => h('div', { class: ['mpd-flex', 'mpd-flex-center', 'mpd-items-center', 'mpd-justify-center'] }, h(ElIcon, { size: 24, color: '#E6A23C' }, () => h(IconFailed))),
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

type Style = Partial<Record<keyof CSSProperties, string | number>>
export function format(style: Style, excludes: string[] = []) {
  return Object.entries(style).reduce<Partial<CSSProperties>>(
    (obj, _style) => {
      const [key, value] = _style
      if (excludes.includes(key))
        return obj
      if (typeof value === 'number') {
        // @ts-expect-error: value is not a number
        obj[key] = key === 'zIndex' ? value : `${value}px`
      }
      else if (value?.startsWith('http')) {
        // @ts-expect-error: value is not a number
        obj[key] = `url(${value})`
      }
      else {
        // @ts-expect-error: value is not a number
        obj[key] = value
      }
      return obj
    },
    {} as Partial<CSSProperties>,
  )
}

export function normalizeStyle(customStyle: Record<string, any>, mode: 'grid' | 'free' = 'grid') {
  const { x, y, ..._style } = customStyle
  const style = format(_style)
  const image = style.backgroundImage || style.background
  if (typeof image === 'string' && image.startsWith('url(')) {
    style.backgroundSize = '100%'
    style.backgroundRepeat = 'no-repeat'
  }

  if (mode === 'free') {
    style.transform = `translate(${x}px, ${y}px)`
    style.position = 'absolute'
    style.top = '0px'
    style.left = '0px'
  }
  return style
}
