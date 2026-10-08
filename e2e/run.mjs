#!/usr/bin/env node
/**
 * DND Editor 端到端验证
 *
 * 用真实浏览器加载构建后的编辑器（packages/editor/dist），
 * 通过模块联邦从构建后的生产者（packages/widgets/dist）加载远端组件，验证：
 *   1. 编辑器自定义元素 <mpd-editor> 能挂载
 *   2. 生产者 setup 通过模块联邦加载，element-plus 样式被注入 shadow dom
 *   3. 生产者视图在 shadow dom 内渲染 element-plus 组件（el-image）
 *   4. element-plus 在宿主与生产者之间是同一个共享单例
 *
 * 拓扑：生产者产物挂在同源根路径（其 manifest 的 publicPath 为 "/"），
 * 与文档推荐的部署方式一致（`${window.location.origin}/design-widgets`）。
 *
 * 只用 Node 内置能力 + 本地 playwright 缓存的 chromium，不引入 npm 依赖。
 * 运行：node e2e/run.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
// 端口交给系统分配，避免与本地 dev server（pnpm dev 用的 8082）冲突
const PORT = 0
const CDP_PORT = 9333
let ORIGIN = ''
const PROFILE_DIR = '/tmp/dnde-e2e-chrome-profile'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

// 可用 CHROME_PATH 指定 chromium/edge，默认取 playwright 缓存或系统 chrome
const CHROME = process.env.CHROME_PATH || ['chromium-1234', 'chromium-1228', 'chromium-1208']
  .map(d => join(homedir(), '.cache/ms-playwright', d, 'chrome-linux64/chrome'))
  .concat(['/usr/bin/chromium', '/usr/bin/google-chrome'])
  .find(p => existsSync(p))

function startStaticServer(routes, port, cors) {
  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': '*',
      })
      res.end()
      return
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const entry = Object.entries(routes).find(([prefix]) => {
        if (prefix === '/')
          return true
        return pathname === prefix || pathname.startsWith(`${prefix}/`)
      })
      if (!entry) {
        res.writeHead(404)
        res.end('not found')
        return
      }
      let rel = entry[0] === '/' ? pathname : pathname.slice(entry[0].length)
      if (rel === '' || rel.endsWith('/'))
        rel += 'index.html'
      const file = join(entry[1], rel)
      const body = await readFile(file)
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'application/octet-stream',
        ...(cors ? { 'Access-Control-Allow-Origin': '*' } : {}),
      })
      res.end(body)
    }
    catch {
      res.writeHead(404, cors ? { 'Access-Control-Allow-Origin': '*' } : undefined)
      res.end('not found')
    }
  })
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)))
}

async function connectCDP(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res())
    ws.addEventListener('error', () => rej(new Error('CDP 连接失败')))
  })
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    const p = pending.get(msg.id)
    if (!p)
      return
    pending.delete(msg.id)
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
  })
  return {
    send(method, params = {}) {
      return new Promise((resolvePromise, reject) => {
        const id = ++seq
        pending.set(id, { resolve: resolvePromise, reject })
        ws.send(JSON.stringify({ id, method, params }))
      })
    },
    close: () => ws.close(),
  }
}

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })

const servers = []
let chrome
let cdp
let state = null

async function cleanup() {
  try { cdp?.close() }
  catch {}
  try { chrome?.kill('SIGKILL') }
  catch {}
  await Promise.all(servers.map(s => new Promise(r => s.close(r))))
  await rm(PROFILE_DIR, { recursive: true, force: true }).catch(() => {})
}

try {
  if (!CHROME)
    throw new Error('未找到 chromium，请先安装 playwright chromium 或系统 chromium')

  for (const p of ['packages/editor/dist/editor.js', 'packages/widgets/dist/mf-manifest.json']) {
    if (!existsSync(join(ROOT, p)))
      throw new Error(`缺少构建产物 ${p}，请先执行 pnpm bootstrap 与 pnpm -C packages/widgets build`)
  }

  // 远程组件产物挂在同源根路径下：manifest 里 publicPath 是 "/"，
  // 因此生产者与宿主必须同源（对应文档推荐的生产部署 `${window.location.origin}/design-widgets`）
  servers.push(await startStaticServer({
    '/editor': join(ROOT, 'packages/editor/dist'),
    '/host': join(ROOT, 'e2e/host'),
    '/': join(ROOT, 'packages/widgets/dist'),
  }, PORT, false))
  ORIGIN = `http://127.0.0.1:${servers[0].address().port}`

  const probe = await fetch(`${ORIGIN}/mf-manifest.json`)
  if (!probe.ok)
    throw new Error(`远端 manifest 不可达：${probe.status}`)

  await rm(PROFILE_DIR, { recursive: true, force: true })
  chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    'about:blank',
  ], { stdio: 'ignore' })

  const bootStart = Date.now()
  for (;;) {
    try {
      await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).json()
      break
    }
    catch {
      if (Date.now() - bootStart > 20000)
        throw new Error('chromium devtools 未能就绪')
      await sleep(200)
    }
  }

  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
  const page = targets.find(t => t.type === 'page')
  if (!page)
    throw new Error('未找到 page target')

  cdp = await connectCDP(page.webSocketDebuggerUrl)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.navigate', { url: `${ORIGIN}/host/` })

  /** 等待编辑器 shadow DOM 内出现某个元素（如经模块联邦异步加载的生产者组件） */
  async function waitInEditor(selector, timeout = 10000) {
    const start = Date.now()
    for (;;) {
      const res = await cdp.send('Runtime.evaluate', {
        expression: `!!document.getElementById('editor').shadowRoot.querySelector(${JSON.stringify(selector)})`,
        returnByValue: true,
      })
      if (res?.result?.value === true)
        return
      if (Date.now() - start > timeout)
        throw new Error(`等待元素超时：${selector}`)
      await sleep(200)
    }
  }

  /** 在编辑器 shadow DOM 内用真实鼠标事件点击某个元素 */
  async function clickInEditor(selector) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('editor').shadowRoot.querySelector(${JSON.stringify(selector)})
        if (!el) return null
        const r = el.getBoundingClientRect()
        return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) })
      })()`,
      returnByValue: true,
    })
    const value = res?.result?.value
    if (!value)
      throw new Error(`找不到元素：${selector}`)
    const { x, y } = JSON.parse(value)
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
    await sleep(300)
  }

  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__E2E__ || null)',
      returnByValue: true,
    })
    const value = res?.result?.value
    if (value) {
      state = JSON.parse(value)
      if (state.phase === 'done' || state.phase === 'error')
        break
    }
    await sleep(300)
  }

  if (!state)
    throw new Error('页面未上报状态')

  check('编辑器自定义元素成功挂载', state.mounted === true)
  // 生产者不再注入冗余的 el- 主题；shadow 里应当是编辑器自己的 mpd 主题
  check(
    'shadow DOM 使用编辑器自己的 mpd 主题',
    (state.shadowCss?.mpdVars || 0) > 0,
    `mpdVars=${state.shadowCss?.mpdVars}`,
  )
  check(
    '生产者不再注入冗余的 el- 主题（shadow 里没有 --el- 变量）',
    (state.shadowCss?.elVars || 0) === 0,
    `elVars=${state.shadowCss?.elVars}, shadowCss=${state.shadowCss?.total}`,
  )
  check('生产者视图在 shadow dom 内渲染 element-plus 组件', state.hasElImage === true)
  const unresolved = (state.warnings || []).filter(w => /resolve component/i.test(w))
  check('无「Failed to resolve component」告警', unresolved.length === 0, unresolved.join(' | '))
  check('页面无未捕获错误', state.phase === 'done' && (state.errors || []).length === 0, (state.errors || []).join(' | '))

  // element-plus 不能被宿主共享：一旦共享，生产者组件的命名空间会从默认的 `el-` 变成宿主的
  // `mpd-`，于是 teleport 到 document.body 的弹层（ElSelect 下拉、ElTooltip 等）会因为宿主页面
  // 只有 `el-` 全局样式而完全失去样式。
  // 生产者组件在编辑器的组件树里渲染，应当使用编辑器那份 element-plus（命名空间 mpd）
  check(
    '生产者组件使用编辑器的 element-plus（namespace mpd-）',
    /mpd-image/.test(state.cardImgClass || ''),
    `img class=${state.cardImgClass}`,
  )
  const instances = state.federation?.instances || []
  check(
    'element-plus 由宿主提供、被远端消费（provider.from === editor）',
    state.federation?.elementPlusFrom === 'editor',
    `from=${state.federation?.elementPlusFrom}, instances=${instances.map(i => i.name).join(',')}`,
  )

  // 节点操作栏 tooltip：必须由编辑器自身的 mpd 命名空间样式着色（曾退化成 el- 而丢样式）
  check(
    '节点操作栏 tooltip 使用 mpd 命名空间（不依赖生产者注入的 el- 样式）',
    /mpd-popper/.test(state.tooltip?.cls || ''),
    `tooltip=${JSON.stringify(state.tooltip)}`,
  )
  check(
    'tooltip 实际被着色（非透明背景）',
    state.tooltip?.found === true && state.tooltip.background !== 'rgba(0, 0, 0, 0)',
    `bg=${state.tooltip?.background}`,
  )

  // ElSelect 下拉：必须留在 shadow DOM 内并被编辑器自身样式着色
  check(
    '配置区 ElSelect 下拉留在 shadow DOM 内（未 teleport 到 body）',
    state.select?.found === true && state.select.inShadow === true,
    `select=${JSON.stringify(state.select)}`,
  )
  check(
    'ElSelect 下拉使用 mpd 命名空间且被着色',
    /mpd-select__popper/.test(state.select?.popperClass || '')
    && state.select?.popperBackground !== 'rgba(0, 0, 0, 0)',
    `popper=${state.select?.popperClass} bg=${state.select?.popperBackground} item=${state.select?.itemHeight}`,
  )

  // 生产者组件的弹层（teleport 到 body）：靠投放到 light DOM 的主题兜底
  check(
    'light DOM 已注入弹层主题（document.head #mpd-popper-styles）',
    state.popperStyle != null && /:root\{--mpd-/.test(state.popperStyle.head),
    `head=${state.popperStyle?.head}`,
  )
  // 生产者 element.config.vue（ElButton + ElDialog + ElSelect，全部依赖全局注册）：
  // 用真实鼠标事件打开弹窗，验证 teleport 到 body 的内容也能被样式覆盖
  // 选中卡片（用元素 click()，CDP 坐标点击在嵌套画布里不稳定）
  await cdp.send('Runtime.evaluate', {
    expression: `document.getElementById('editor').shadowRoot.querySelector('.mpd-node[data-id="card-1"] .node-wrap').click()`,
  })
  // element.config.vue 是经模块联邦异步加载的，等按钮出现
  await waitInEditor(`.mpd-button`)
  // 生产者 element.config.vue：ElButton + ElDialog + ElSelect，全部依赖全局注册。
  // - ElDialog 默认不 append-to-body，渲染在 shadow DOM 内（因此由 shadow 里的主题负责）
  // - 弹窗里的 ElSelect 下拉会 teleport 到 document.body（由 light DOM 那份主题负责）
  await clickInEditor(`.mpd-button`)
  await sleep(500)

  const dialogInfo = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const sr = document.getElementById('editor').shadowRoot
      const dialog = sr.querySelector('.mpd-dialog')
      if (!dialog) return JSON.stringify({ found: false })
      const cs = getComputedStyle(dialog)
      return JSON.stringify({
        found: true,
        inShadow: dialog.getRootNode() === sr,
        cls: dialog.className,
        background: cs.backgroundColor,
        width: cs.width,
      })
    })()`,
    returnByValue: true,
  })
  const dialog = JSON.parse(dialogInfo.result.value)

  // 点开弹窗里的 select，它的下拉应该出现在 body 里并且仍然有样式
  await clickInEditor(`.mpd-dialog .mpd-select__wrapper`)
  await sleep(500)
  const bodyDropdownInfo = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const dd = document.body.querySelector('.mpd-select-dropdown')
      if (!dd) return JSON.stringify({ found: false, bodyEls: [...document.body.children].map(n => n.id || n.className).slice(0, 6) })
      const popper = dd.parentElement
      const cs = getComputedStyle(popper)
      const item = dd.querySelector('.mpd-select-dropdown__item') || document.body.querySelector('.mpd-select-dropdown__item')
      return JSON.stringify({
        found: true,
        inBody: dd.getRootNode() === document,
        popperClass: popper.className,
        popperBackground: cs.backgroundColor,
        popperBoxShadow: cs.boxShadow,
        itemHeight: item ? getComputedStyle(item).height : null,
      })
    })()`,
    returnByValue: true,
  })
  const bodyDropdown = JSON.parse(bodyDropdownInfo.result.value)

  check(
    '生产者 element.config.vue 的 ElDialog 在编辑器内渲染且被着色',
    dialog?.found === true && dialog.inShadow === true
    && /mpd-dialog/.test(dialog.cls || '')
    && dialog.background !== 'rgba(0, 0, 0, 0)',
    `dialog=${JSON.stringify(dialog)}`,
  )
  check(
    '生产者弹窗内的 ElSelect 下拉 teleport 到 body 后仍有样式（light DOM 主题兜底）',
    bodyDropdown?.found === true && bodyDropdown.inBody === true
    && /mpd-select__popper/.test(bodyDropdown.popperClass || '')
    && bodyDropdown.popperBackground !== 'rgba(0, 0, 0, 0)',
    `dropdown=${JSON.stringify(bodyDropdown)}`,
  )
  // injectGlobalStyle: false —— 不往宿主 head 注入主题
  await cdp.send('Page.navigate', { url: `${ORIGIN}/host/?nogstyle=1` })
  let offState = null
  const offDeadline = Date.now() + 45000
  while (Date.now() < offDeadline) {
    const res = await cdp.send('Runtime.evaluate', {
      expression: 'JSON.stringify(window.__E2E__ || null)',
      returnByValue: true,
    })
    const value = res?.result?.value
    if (value) {
      offState = JSON.parse(value)
      if (offState.phase === 'done' || offState.phase === 'error')
        break
    }
    await sleep(300)
  }
  const offInfo = await cdp.send('Runtime.evaluate', {
    expression: `JSON.stringify({
      injected: !!document.getElementById('mpd-popper-styles'),
      mounted: !!document.getElementById('editor')?.shadowRoot?.querySelector('.mpd-editor'),
      shadowTheme: [...document.getElementById('editor').shadowRoot.querySelectorAll('style')]
        .some(s => (s.textContent || '').includes('--mpd-color-white')),
    })`,
    returnByValue: true,
  })
  const off = JSON.parse(offInfo.result.value)
  check(
    'injectGlobalStyle: false 时不向宿主 head 注入主题',
    off.injected === false && offState?.phase === 'done',
    `injected=${off.injected}, phase=${offState?.phase}`,
  )
  check(
    'injectGlobalStyle: false 时编辑器仍可用（shadow 内主题仍在）',
    off.mounted === true && off.shadowTheme === true,
    `mounted=${off.mounted}, shadowTheme=${off.shadowTheme}`,
  )

}
catch (err) {
  check('E2E 执行未抛异常', false, String((err && err.stack) || err))
}
finally {
  await cleanup()
}

console.log('\n================ E2E 结果 ================')
if (state)
  console.log(JSON.stringify(state, null, 2))
console.log('------------------------------------------')
for (const r of results)
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`)
const failed = results.filter(r => !r.ok)
console.log(`------------------------------------------\n${failed.length ? `✗ ${failed.length}/${results.length} 项失败` : `✓ 全部 ${results.length} 项通过`}`)
process.exitCode = failed.length ? 1 : 0
