/**
 * 生产者（rsbuild / rspack）的 CSS chunk 加载与热更新都围绕 `<link>` 展开，默认挂到
 * `document.head`。编辑器把「加载」重定向到 shadow root：取回 CSS 文本后以 `<style>` 注入，
 * 这样样式只作用在编辑器内部，不会污染宿主页面（见 main.ts 的处理链路）。
 *
 * 重定向带来两个问题，这里负责兜住：
 *
 * 1. 热更新时 rspack 要先在 DOM 里找到「旧的样式表」，再在它旁边插入带新内容的 `<link>`。
 *    它默认只在 `document` 里找，而我们的样式在 shadow root 中，找不到就整段放弃 ——
 *    表现为「改了生产者的样式，开发态下画布不更新」（看起来就像样式丢失）。
 *    因此注入时记上 `data-href`，并把「按 href 查 shadow root 里的样式表」暴露成
 *    `__dnde_find_shadow_css__`，交给 `@sepveneto/dnd-plugins` 对运行时的补丁去调用。
 *
 * 2. shadow root 会随编辑器卸载/重挂而重建（宿主热更新、路由切换）。重建后模块缓存里
 *    仍有 CSS 的加载记录，rspack 不会再次注入，新 shadow root 里就没有样式了。
 *    这里记住已经投放过的样式地址，新的 shadow root 登记时重新投放一份。
 */

const STYLE_HREF_ATTR = 'data-href'

/** 已挂载编辑器的 shadow root：同一页面可能有多个 `<mpd-editor>` */
const roots = new Set<ShadowRoot>()

/** 已经投放过的样式地址（normalize 掉热更新的查询串） */
const knownHrefs = new Set<string>()

let installed = false

function normalizeHref(href?: string | null) {
  if (!href)
    return ''
  try {
    // 带查询串的是热更新时用来强制刷新的地址，比较时只认路径部分
    return new URL(href, typeof location === 'undefined' ? undefined : location.href).href.split('?')[0]
  }
  catch {
    return href.split('?')[0]
  }
}

/** 仍然连接在页面上的 shadow root：卸载中的（已脱离文档）不应再参与查找 */
function connectedRoots() {
  return [...roots].filter(root => root.host?.isConnected)
}

function pickRoot() {
  return connectedRoots().pop()
}

/** 按 href 在 shadow root 里找样式表（注入的 `<style data-href>` 或 rspack 热更新插入的 `<link>`） */
function findShadowStylesheet(href: string, fullhref: string) {
  const wanted = [normalizeHref(href), normalizeHref(fullhref)].filter(Boolean)
  if (!wanted.length)
    return undefined

  for (const root of connectedRoots()) {
    const nodes = root.querySelectorAll<HTMLElement>(`style[${STYLE_HREF_ATTR}], link[rel="stylesheet"]`)
    for (const node of nodes) {
      const current = normalizeHref(node.getAttribute(STYLE_HREF_ATTR) || node.getAttribute('href'))
      if (current && wanted.includes(current))
        return node
    }
  }
  return undefined
}

/** 同一个 href 只保留一份：已有 `<style>` 就地换内容，否则新建 */
function upsertShadowStyle(root: ShadowRoot, href: string, css: string) {
  const key = normalizeHref(href)
  for (const style of root.querySelectorAll<HTMLStyleElement>(`style[${STYLE_HREF_ATTR}]`)) {
    if (normalizeHref(style.getAttribute(STYLE_HREF_ATTR)) === key) {
      style.textContent = css
      return
    }
  }

  const style = document.createElement('style')
  style.setAttribute(STYLE_HREF_ATTR, href)
  style.textContent = css
  root.appendChild(style)
}

/** 取回样式文本并投放进 shadow root，随后手动触发 link 的 load/error，保证组件的加载流程照常走下去 */
async function injectShadowStyle(root: ShadowRoot, href: string, tagLink: HTMLLinkElement) {
  try {
    const css = await (await fetch(href)).text()
    upsertShadowStyle(root, href, css)
    tagLink.dispatchEvent(new Event('load'))
  }
  catch (err) {
    console.error(err)
    tagLink.dispatchEvent(new Event('error'))
  }
}

/**
 * 装上供生产者运行时调用的两个全局函数。由编辑器挂载时调用一次即可。
 */
export function installShadowCssRuntime() {
  if (typeof window === 'undefined' || installed)
    return
  installed = true

  const scope = window as any
  scope.__dnde_find_shadow_css__ = findShadowStylesheet
  scope.__shadowdom_css_runtime__ = (tagLink: HTMLLinkElement) => {
    const href = tagLink.href || tagLink.getAttribute('href') || ''
    if (!href)
      return

    knownHrefs.add(normalizeHref(href))
    const root = pickRoot()
    if (!root) {
      // 编辑器还没挂载：退回运行时原本的行为，先让样式生效，挂载后再由 shadow root 承接
      document.head.appendChild(tagLink)
      return
    }
    return injectShadowStyle(root, href, tagLink)
  }
}

/**
 * 登记编辑器的 shadow root。重建出来的 shadow root（宿主热更新 / 路由切换）会把之前
 * 加载过的样式重新投放一份 —— 模块缓存不会让 rspack 再注入一次。
 * 返回注销函数，编辑器卸载时调用。
 */
export function registerShadowCssRoot(shadowRoot: ShadowRoot | undefined) {
  if (!shadowRoot)
    return () => {}

  roots.add(shadowRoot)
  for (const href of knownHrefs) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    injectShadowStyle(shadowRoot, href, link)
  }

  return () => roots.delete(shadowRoot)
}
