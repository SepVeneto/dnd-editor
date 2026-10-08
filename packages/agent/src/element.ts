/**
 * Agent 的 web component 出口。
 *
 * 把库入口暴露的 `MpdAgent` 包装成一个原生自定义元素 `<dnd-agent>`：
 *
 * ```ts
 * import '@sepveneto/dnde-agent/element' // 注册 <dnd-agent>
 * // 或
 * import { registerAgentElement } from '@sepveneto/dnde-agent/element'
 * registerAgentElement('my-agent')
 * ```
 *
 * 注意：库入口 `@sepveneto/dnde-agent` 是纯方法/类型导出，不会注册自定义元素；
 * 需要 `<dnd-agent>` 时走本入口（或显式调用 `registerAgentElement`）。
 */
import type { VueElementConstructor } from 'vue'
import { defineCustomElement } from 'vue'
import { MpdAgent } from './index'

export * from './index'

const DEFAULT_TAG_NAME = 'dnd-agent'

let cachedElement: VueElementConstructor | undefined

/**
 * 取自定义元素类（第一次调用时才创建，避免在 SSR / Node 里 import 报错）。
 */
export function getAgentElement(): VueElementConstructor {
  if (!cachedElement) {
    cachedElement = defineCustomElement(MpdAgent)
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

// import 本入口即注册 <dnd-agent>（非浏览器环境会被 registerAgentElement 忽略）
registerAgentElement()

declare global {
  interface HTMLElementTagNameMap {
    'dnd-agent': HTMLElement
  }
}
