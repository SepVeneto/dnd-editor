/**
 * Agent 的 web component 出口。
 *
 * 这个文件把现有的 `Copilot.vue` 包装成一个原生自定义元素，注册后就可以在任意
 * 页面里直接使用：
 *
 * ```html
 * <script type="module" src="./dnd-agent.js"></script>
 * <dnd-agent></dnd-agent>
 * ```
 *
 * 在 Vue / React 等框架里，只需要 `import '@sepveneto/agent'` 即可完成注册，
 * 也可以调用 `registerAgentElement(tagName)` 换成自己的标签名。
 */
import type { CustomElementConstructor } from 'vue'
import { defineCustomElement } from 'vue'
import Copilot from './agent/Copilot.vue'

export * from './index'

const DEFAULT_TAG_NAME = 'dnd-agent'

let cachedElement: CustomElementConstructor | undefined

/**
 * 取自定义元素类（第一次调用时才创建，避免在 SSR / Node 里 import 报错）。
 */
export function getAgentElement(): CustomElementConstructor {
  if (!cachedElement) {
    cachedElement = defineCustomElement(Copilot)
  }
  return cachedElement
}

/**
 * 注册 `<dnd-agent>`；重复注册同一个标签名会被忽略。
 * 返回真正注册的标签名，非浏览器环境返回 undefined。
 */
export function registerAgentElement(tagName: string = DEFAULT_TAG_NAME): string | undefined {
  if (typeof window === 'undefined' || !window.customElements) {
    return undefined
  }

  if (!window.customElements.get(tagName)) {
    window.customElements.define(tagName, getAgentElement())
  }

  return tagName
}

// 浏览器里 import 即注册，方便直接当脚本引用
registerAgentElement()

declare global {
  interface HTMLElementTagNameMap {
    'dnd-agent': HTMLElement
  }
}
