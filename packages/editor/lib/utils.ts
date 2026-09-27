import type { ModuleFederation } from '@module-federation/enhanced/runtime'
import type { AppContext, CSSProperties, InjectionKey, Ref, VNode } from 'vue'
import {
  WarningFilled as IconFailed,
  Loading as IconLoading,
} from '@element-plus/icons-vue'
import { createInstance } from '@module-federation/enhanced/runtime'
import debug from 'debug'
import * as ElementPlus from 'element-plus'
import * as Vue from 'vue'
import { createVNode, defineAsyncComponent, h, render } from 'vue'

const { ElConfigProvider, ElIcon, ElTooltip } = ElementPlus

let mf: ModuleFederation

export function initMf(url: string) {
  mf = createInstance({
    name: 'editor',
    remotes: [],
    shared: {
      vue: {
        version: '3.5.40',
        lib: () => Vue,
        shareConfig: {
          singleton: true,
          requiredVersion: '^3.5.40',
        },
      },
      'element-plus': {
        version: '2.14.3',
        lib: () => ElementPlus,
        shareConfig: {
          singleton: true,
          requiredVersion: '^2.14.1',
        },
      },
    },
  })
  mf.registerRemotes([
    {
      name: 'widgets',
      entry: `${url}/mf-manifest.json`,
    },
  // 必须开启，否则从其它页面切换回编辑器会导致渲染异常
  ])

  return mf
}

export function loadFromRemote(scope: string, module: string) {
  const renderer = defineAsyncComponent({
    loader: () => mf.loadRemote(`${scope}/${module}`) as any,
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

  const tooltip = createVNode(ElTooltip, {
    virtualTriggering: true,
    virtualRef: trigger,
    appendTo: parent,
    placement: 'top',
    transition: 'none',
    offset: 4,
    hideAfter: 0,
  }, { content: () => content })

  // tooltip 挂在独立渲染根上，拿不到编辑器 <ElConfigProvider namespace="mpd"> 的注入。
  // 不显式补一层 provider 的话它会退化成 element-plus 默认的 `el-` 命名空间，
  // 而编辑器自身的样式是按 `mpd` 命名空间编译的，于是 tooltip 会完全没有样式。
  const vm = createVNode(ElConfigProvider, { namespace: 'mpd' }, { default: () => tooltip })
  vm.appContext = ctx

  const container = document.createElement('div')
  render(vm, container)
  tooltip.component!.exposed!.onOpen()

  removePopper = () => {
    render(null, container)
    removePopper = null
  }

  removePopper.trigger = trigger
  removePopper.vm = tooltip
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

export function createDebug(namespace: string) {
  return debug(`mpd:${namespace}`)
}

export const EditorKey: InjectionKey<{ root: Ref<HTMLDivElement | null> }> = Symbol('EditorContext')
