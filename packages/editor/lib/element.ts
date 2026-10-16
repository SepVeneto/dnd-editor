/**
 * `<mpd-editor>` 自定义元素。
 *
 * 元素在模块加载时就注册（见 main.ts 的 `register` 与文件末尾），宿主因此可以无条件地
 * 在模板里渲染 `<mpd-editor>`，不需要用 v-if 之类的开关去对齐渲染时机：
 *
 * - 组件定义是异步的（等宿主 `register()` 给出生产者地址、生产者 `setup` 加载完再挂载），
 *   等待期间先往 shadow root 里放一个加载占位，挂载时由 Editor.vue 撤掉；
 * - 挂载前调用的指令式 API（register / validate / getData / setData）会先排队，
 *   挂载后补上，见 ./api.ts。
 */
import type { App, Component } from 'vue'
import type { EditorApi } from './api'
import { defineCustomElement } from 'vue'
import { bindEditorApi, invokeEditorApi } from './api'

/** `<mpd-editor>` 注册的标签名 */
export const EDITOR_ELEMENT_TAG = 'mpd-editor'

const LOADING_CLASS = 'mpd-editor-loading'

/** 占位自带的样式：此刻 shadow root 里还没有编辑器自己的样式 */
const LOADING_STYLE = `
.${LOADING_CLASS} {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 120px;
  padding: 24px;
}
.${LOADING_CLASS}__spinner {
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  border: 2px solid #dcdfe6;
  border-top-color: #4089ef;
  border-radius: 50%;
  animation: ${LOADING_CLASS}-spin .8s linear infinite;
}
@keyframes ${LOADING_CLASS}-spin {
  to { transform: rotate(360deg); }
}
`

function createLoadingPlaceholder(): HTMLElement {
  const box = document.createElement('div')
  box.className = LOADING_CLASS
  box.setAttribute('role', 'status')
  box.setAttribute('aria-busy', 'true')

  const style = document.createElement('style')
  style.textContent = LOADING_STYLE
  box.appendChild(style)

  const spinner = document.createElement('div')
  spinner.className = `${LOADING_CLASS}__spinner`
  box.appendChild(spinner)

  return box
}

export interface EditorElementInit {
  /** 组件定义：等待 `register()` 与生产者 setup 的异步定义（见 main.ts） */
  definition: Component
  /** 每个元素实例创建应用时调用：装上编辑器自己的 pinia 与生产者声明的插件 */
  configureApp: (app: App) => void
}

export function createEditorElement({ definition, configureApp }: EditorElementInit): CustomElementConstructor {
  // defineCustomElement 的重载不接受 Component 联合类型（异步定义也是组件），这里按 any 传入
  const BaseElement = defineCustomElement(definition as any, { configureApp })

  return class MpdEditorElement extends BaseElement {
    constructor() {
      super()
      // 真正的编辑器要等 register() 与生产者 setup，先把位置占上，避免宿主看到一片空白
      this.shadowRoot?.appendChild(createLoadingPlaceholder())
    }

    register(fn: (ctx: any) => { init: () => void }) {
      return invokeEditorApi(this, 'register', [fn])
    }

    validate() {
      return invokeEditorApi(this, 'validate', [])
    }

    getData() {
      return invokeEditorApi(this, 'getData', [])
    }

    setData(data: { _view: string, list: any[] }) {
      return invokeEditorApi(this, 'setData', [data])
    }
  }
}

/**
 * 编辑器挂载完成（在 Editor.vue 的 setup 里调用）：撤掉加载占位，并交出指令式 API 的实现，
 * 挂载前排队的方法调用会在这里补上。
 */
export function bindEditorElement(host: any, api: EditorApi): void {
  if (!host)
    return

  host.shadowRoot?.querySelector(`.${LOADING_CLASS}`)?.remove()
  bindEditorApi(host, api)
}
