import { defineCustomElement } from 'vue'
import Main from './Editor.vue'
import { createPinia } from 'pinia'
import { setAgentImporter } from './agents/loader.js'
import type { AgentImporter } from './agents/loader.js'
import elementPlusCss from './styles/popper.scss?inline'
import { injectPopperStyles, initMf } from './utils.js'

export type EditorInstance = InstanceType<typeof Main>

// 宿主关闭 injectGlobalStyle 后，也可以在合适时机自行调用
export { injectPopperStyles }
export type { AgentImporter } from './agents/loader.js'

let initPromise = new Map<string, Promise<boolean>>()

export interface RegisterOptions {
  /**
   * 组件视图的远程地址
   */
  remoteUrl: string
  /**
   * 是否把 element-plus 主题再挂一份到宿主页面的 `document.head`（默认开启）。
   *
   * 弹层（`ElDialog` / `ElSelect` 下拉 / `ElTooltip` 等）会 teleport 到 `document.body`，
   * 不在 shadow DOM 内，拿不到编辑器内部的样式，需要这份 light DOM 的样式兜底。
   * 关闭后需要宿主自行保证这些弹层的样式。
   */
  injectGlobalStyle?: boolean
  /**
   * agent（装修助手）的加载方式，可选。
   *
   * agent 是独立的 web component，编辑器不强制依赖它：不注入时编辑器照常工作，
   * 只有业务侧开启了 `<mpd-editor agent>` 时才会在控制台提示安装。需要该能力时在这里
   * 显式注入，交给宿主打包器解析依赖：
   *
   * ```ts
   * register({ remoteUrl, agent: () => import('@sepveneto/dnde-agent/element') })
   * ```
   */
  agent?: AgentImporter
}

export function register(options: RegisterOptions): Promise<boolean> {
  // 注意放在缓存判断之前：先关后开时也能补上
  if (options.injectGlobalStyle ?? true)
    injectPopperStyles()

  // agent 是可选的：由宿主显式注入加载方式。不注入时编辑器仍可正常使用，
  // 只是开启 agent 时会在控制台给出安装提示。
  if (options.agent)
    setAgentImporter(options.agent)

  const cached = initPromise.get(options.remoteUrl)
  if (cached) return cached

  const promise = (async () => {
    const mf = initMf(options.remoteUrl)
    const setup: any = await mf.loadRemote('widgets/setup').catch((err) => {
      console.error(err)
      return {}
    })
    const Editor = defineCustomElement(Main, {
      configureApp(app) {
        const store = createPinia()
        app.use(store)

        setup.use?.forEach((item: any) => {
          app.use(item.plugin, item.options)
        })
      },
      // 主题只打包一份：这里注入 shadow root（变量作用在 :host），
      // injectPopperStyles() 把同一份字符串投放到 document.head 兜住 teleport 的弹层
      styles: [elementPlusCss.replaceAll(':root', ':host'), ...(setup?.styles ?? [])],
    })

    // 自定义元素只能注册一次，已注册时复用即可。
    // 这里不能再提前 return，否则 promise 永远不会 settle，调用方将永久挂起
    if (!customElements.get('mpd-editor')) {
      customElements.define('mpd-editor', Editor)
    }

    return true
  })().catch((err) => {
    // 失败时清除缓存，允许调用方重试，而不是一直复用同一个 rejected promise
    initPromise.delete(options.remoteUrl)
    throw err
  })

  initPromise.set(options.remoteUrl, promise)
  return promise
}
