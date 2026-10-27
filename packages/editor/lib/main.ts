import type { App } from 'vue'
import type { AgentImporter } from './agents/loader.js'
import ElementPlus from 'element-plus'
// @ts-expect-error: no def
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { createPinia } from 'pinia'
import { defineAsyncComponent } from 'vue'
import { setAgentImporter } from './agents/loader.js'
import Main from './Editor.vue'
import { createEditorElement, EDITOR_ELEMENT_TAG } from './element.js'
import elementPlusCss from './styles/popper.scss?inline'
import { initMf, injectPopperStyles } from './utils.js'

export type EditorInstance = InstanceType<typeof Main>

export { EDITOR_ELEMENT_TAG }
// 宿主关闭 injectGlobalStyle 后，也可以在合适时机自行调用
export { injectPopperStyles }
export type { AgentImporter } from './agents/loader.js'

const PRODUCER_STYLE_ID = 'mpd-producer-styles'

/** 生产者（组件视图）通过 `widgets/setup` 声明的插件与样式 */
interface ProducerSetup {
  use?: Array<{ plugin: any, options?: any }>
  styles?: string[]
}

/**
 * 生产者自己声明的样式（`setup.styles`）默认只进 shadow root。
 * 但经 `createDialog` 等命令式 API 渲染到 `document.body` 的弹层同样拿不到 shadow DOM 里的样式，
 * 因此再往 `document.head` 投放一份相同的样式，兜住这部分弹层（含生产者自己的 `bc-*` 规则）。
 * 与 `injectPopperStyles()` 一样，由 `injectGlobalStyle` 开关统一控制。
 */
function injectProducerStyles(styles: string[]) {
  if (typeof document === 'undefined' || !styles.length)
    return
  let style = document.getElementById(PRODUCER_STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = PRODUCER_STYLE_ID
    document.head.appendChild(style)
  }
  // 与 injectPopperStyles() 同理：shadow root 里作用在 :host 的样式，
  // 投放到 light DOM 时需要换成 :root。
  style.textContent = styles.map(item => item.replaceAll(':host', ':root')).join('\n')
}

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
   * 除了 element-plus 主题，生产者自己声明的 `setup.styles` 也会一并投放一份。
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

function defer<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/**
 * `register()` 之前元素就已经注册好了（见文件末尾），这里只等第一个 `register()` 把
 * 生产者地址带进来：`<mpd-editor>` 可以先渲染、后注册，渲染时机完全由宿主决定。
 */
const registration = defer<RegisterOptions>()

/** 元素的挂载只认第一个 register()：它决定编辑器用哪份主题与生产者插件 */
let registered = false

/** 生产者 setup 按 remoteUrl 缓存，`register()` 因此是幂等的 */
const setups = new Map<string, Promise<ProducerSetup>>()

/** 生产者 setup 的结果，元素挂载（configureApp）时用于注册插件 */
let producerSetup: ProducerSetup = {}

/**
 * 加载生产者的 setup。除了组件视图本身，生产者还会通过它声明自己的插件与样式，
 * 因此必须在编辑器挂载之前拿到。加载失败按空 setup 处理（与组件视图加载失败的表现一致）。
 */
function loadProducerSetup(options: RegisterOptions): Promise<ProducerSetup> {
  const cached = setups.get(options.remoteUrl)
  if (cached)
    return cached

  const injectGlobalStyle = options.injectGlobalStyle ?? true
  const promise = (async () => {
    const mf = initMf(options.remoteUrl)
    const setup = (await mf.loadRemote('widgets/setup').catch((err) => {
      console.error(err)
      return {}
    })) as ProducerSetup
    // 生产者的样式除注入 shadow root 外，再往 light DOM 投放一份，
    // 供 teleport 到 document.body 的弹层（createDialog / ElSelect 下拉等）使用。
    if (injectGlobalStyle)
      injectProducerStyles(setup.styles ?? [])
    return setup
  })().catch((err) => {
    // 失败时清除缓存，允许调用方重试，而不是一直复用同一个 rejected promise
    setups.delete(options.remoteUrl)
    throw err
  })

  setups.set(options.remoteUrl, promise)
  return promise
}

export function register(options: RegisterOptions): Promise<boolean> {
  // 注意放在缓存判断之前：先关后开时也能补上
  if (options.injectGlobalStyle ?? true)
    injectPopperStyles()

  // agent 是可选的：由宿主显式注入加载方式。不注入时编辑器仍可正常使用，
  // 只是开启 agent 时会在控制台给出安装提示。
  if (options.agent)
    setAgentImporter(options.agent)

  // 元素已经在等这个地址了：先渲染 <mpd-editor> 再 register，或者反过来，都可以。
  // 之后的 register() 只影响后续经模块联邦加载的组件视图，不再改变元素定义。
  if (!registered) {
    registered = true
    registration.resolve(options)
  }

  return loadProducerSetup(options).then(() => true)
}

/**
 * 元素的定义：先等 `register()` 把生产者地址交进来，再等生产者 setup 加载完成。
 * 期间 `<mpd-editor>` 已经存在于页面中（显示加载占位），宿主不需要用 v-if 卡住它。
 */
async function loadEditorDefinition() {
  const options = await registration.promise
  producerSetup = await loadProducerSetup(options)
  return {
    ...Main,
    // 主题只打包一份：这里注入 shadow root（变量作用在 :host），
    // injectPopperStyles() 把同一份字符串投放到 document.head 兜住 teleport 的弹层
    styles: [
      elementPlusCss.replaceAll(':root', ':host'),
      ...(producerSetup.styles ?? []),
      ...(Main.styles ?? []),
    ],
  }
}

const EditorElement = createEditorElement({
  definition: defineAsyncComponent(loadEditorDefinition),
  configureApp(app: App) {
    app.use(createPinia())
    // 一次写入 app 级配置，供命令式弹层继承；重复调用 provideGlobalConfig 会触发 Vue 覆盖警告。
    app.use(ElementPlus, { namespace: 'mpd', locale: zhCn })
    producerSetup.use?.forEach((item: any) => app.use(item.plugin, item.options))
  },
})

if (typeof window !== 'undefined' && window.customElements && !window.customElements.get(EDITOR_ELEMENT_TAG)) {
  window.customElements.define(EDITOR_ELEMENT_TAG, EditorElement)
}
