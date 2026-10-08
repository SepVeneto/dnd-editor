/**
 * 可选 agent 能力的加载器。
 *
 * agent 被设计成独立的 web component（`<dnd-agent>`），编辑器自身**不**在构建期依赖
 * `@sepveneto/dnde-agent`：业务侧不安装它也能正常打包、使用编辑器。
 *
 * 加载方式由宿主在 `register({ agent })` 时**显式注入**（通常是
 * `() => import('@sepveneto/dnde-agent/element')`），这样业务侧的打包器才能正确解析依赖。
 * 只开启 `agent` 却没注入、或依赖缺失时，会在控制台提示安装。
 */

/** agent web component 注册的标签名。 */
export const AGENT_ELEMENT_TAG = 'dnd-agent'

/** 可选的 agent 依赖包名。 */
export const AGENT_PACKAGE_NAME = '@sepveneto/dnde-agent'

/** agent 的 web component 入口（注册 `<dnd-agent>`，并 re-export 库方法）。 */
export const AGENT_ELEMENT_ENTRY = `${AGENT_PACKAGE_NAME}/element`

/** 按需加载 agent 包的方式，宿主可以注入自定义实现（如走 import map / CDN）。 */
export type AgentImporter = () => Promise<unknown>

const inflight = new Map<string, Promise<boolean>>()

let injectedImporter: AgentImporter | undefined

/**
 * 注入 agent 的加载方式，由 `register({ agent })` 调用。
 *
 * 传入 `undefined` 可清除（一般不需要）。注入后未完成的加载会被丢弃，允许用新的
 * importer 重新加载。
 */
export function setAgentImporter(importer?: AgentImporter): void {
  injectedImporter = importer
  inflight.clear()
}

/** `<dnd-agent>` 是否已经注册（业务侧自行 import 过该包时即为 true）。 */
export function isAgentRegistered(tag: string = AGENT_ELEMENT_TAG): boolean {
  return typeof window !== 'undefined'
    && !!window.customElements
    && !!window.customElements.get(tag)
}

/**
 * 确保 agent web component 可用。
 *
 * - 已注册：直接返回 `true`；
 * - 未注册：调用宿主注入的加载器，成功后返回 `true`；
 * - 未注入加载器 / 依赖缺失 / 加载失败：在控制台提示安装，并返回 `false`。失败不会缓存，
 *   业务侧后续补上依赖或注入后可以重新触发。
 */
export function loadAgent(
  tag: string = AGENT_ELEMENT_TAG,
  importer: AgentImporter | undefined = injectedImporter,
): Promise<boolean> {
  if (isAgentRegistered(tag))
    return Promise.resolve(true)

  // SSR / 非浏览器环境没有 customElements，直接判定不可用。
  if (typeof window === 'undefined' || !window.customElements)
    return Promise.resolve(false)

  if (!importer) {
    reportMissingAgent()
    return Promise.resolve(false)
  }

  const cached = inflight.get(tag)
  if (cached)
    return cached

  const promise = importer()
    .then((mod) => {
      // 包入口在 import 时即会注册 <dnd-agent>；这里再兜底自定义标签名的情况。
      const register = (mod as { registerAgentElement?: (name?: string) => unknown })?.registerAgentElement
      if (!isAgentRegistered(tag) && typeof register === 'function')
        register(tag)

      if (!isAgentRegistered(tag))
        throw new Error(`agent 包已加载，但 <${tag}> 未注册`)

      return true
    })
    .catch((error) => {
      inflight.delete(tag)
      reportMissingAgent(error)
      return false
    })

  inflight.set(tag, promise)
  return promise
}

function reportMissingAgent(error?: unknown): void {
  const message = '[dnde] 未能加载可选的 agent 能力（装修助手）。\n'
    + `检测到业务侧开启了 agent，但未注入加载器或依赖 \`${AGENT_PACKAGE_NAME}\` 缺失。\n`
    + '请安装依赖并在 register() 时注入：\n'
    + `  register({ remoteUrl, agent: () => import('${AGENT_ELEMENT_ENTRY}') })\n`
    + `或在宿主侧直接 import '${AGENT_ELEMENT_ENTRY}'（会自动注册 <${AGENT_ELEMENT_TAG}>）。`

  if (error === undefined)
    console.error(message)
  else
    console.error(message, error)
}
