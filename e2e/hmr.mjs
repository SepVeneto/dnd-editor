#!/usr/bin/env node
/**
 * 开发态热更新（HMR）端到端验证。
 *
 * 起两个真实的开发服务器（生产者 rsbuild dev + 宿主 vite dev），用真实浏览器改源码，验证：
 *   1. 改生产者的组件视图（`*.view.vue`）→ 编辑器画布原地更新，编辑中的数据保留；
 *   2. 改生产者的组件样式（`<style>`）→ 画布上的样式原地更新（样式在 shadow root 里，
 *      要能被 rspack 的 CSS HMR 找到，见 packages/editor/lib/shadowCss.ts）；
 *   3. 改宿主自己的模板 → 宿主页面照常原地更新（编辑器不能吞掉宿主的更新）；
 *   4. 改业务侧下发的组件配置（schema）→ 配置面板用上新定义、编辑器数据不被清空；
 *   5. 以上都不触发整页刷新。
 *
 * 这是两件事的回归用例：
 *   - 产物自带的 Vue 必须是「开发态」的（见 build/hmr-intro.ts）：一旦 `process.env.NODE_ENV`
 *     又被写死成 production，生产者组件就由一份没有 HMR 注册表的 Vue 实例化，宿主收到的
 *     reload/rerender 找不到实例，第 1 项会静默失败；
 *   - 宿主自己也是 Vue 应用时，两份 HMR 运行时必须共存，否则第 2 项（宿主自己的热更新）会失效。
 *
 * 运行（会临时改动源码文件，结束后自动还原）：
 *   pnpm -C packages/editor build:dev && node e2e/hmr.mjs
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const CDP_PORT = Number(process.env.CDP_PORT || 9333)
const PROFILE_DIR = '/tmp/dnde-hmr-e2e-profile'
const sleep = ms => new Promise(r => setTimeout(r, ms))

const CHROME = process.env.CHROME_PATH || ['chromium-1234', 'chromium-1228', 'chromium-1208']
  .map(d => join(homedir(), '.cache/ms-playwright', d, 'chrome-linux64/chrome'))
  .concat(['/usr/bin/chromium', '/usr/bin/google-chrome'])
  .find(p => existsSync(p))

/** 改动点：锚点必须唯一，改完即还原 */
const VIEW = {
  file: join(ROOT, 'packages/widgets/src/widgets/menuItem.view.vue'),
  // 锚点按运行时读到的文件内容确定，不写死这段占位文案
  from: null,
  to: null,
  needle: 'hmr-probe-view',
}
/** 只改样式：验证 shadow root 里的样式表能被 CSS HMR 找到并原地更新（而不是样式丢失 / 整页刷新） */
const VIEW_STYLE = {
  file: join(ROOT, 'packages/widgets/src/widgets/menuItem.view.vue'),
  from: 'color: crimson;',
  to: 'color: rgb(10, 200, 30);',
  expect: 'rgb(10, 200, 30)',
}
const SCHEMA = {
  file: join(ROOT, 'packages/editor/playground/views/Home.vue'),
  // 锚点按运行时读到的文件内容确定，不写死具体的 label 文案
  from: null,
  to: null,
  needle: '是否显示HMR-E2E',
  // 宿主的源码由 vite 开发服务器即时编译，顺便确认它已经拿到了新代码
  servedUrl: '/playground/views/Home.vue',
}
const HOST_TEMPLATE = {
  file: join(ROOT, 'packages/editor/playground/views/Home.vue'),
  from: '<div>topbar</div>',
  to: '<div>topbar-hmr-probe</div>',
  needle: 'topbar-hmr-probe',
}

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  [${detail}]` : ''}`)
}

const children = []
function startProcess(command, args, cwd) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  children.push(child)
  const chunks = []
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8')
    stream.on('data', (data) => {
      chunks.push(data)
      if (process.env.HMR_E2E_VERBOSE)
        process.stdout.write(data)
    })
  }
  return { child, output: () => chunks.join('') }
}

async function freePort() {
  return new Promise((res) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => res(port))
    })
  })
}

async function waitForUrl(url, timeout = 60000) {
  const start = Date.now()
  for (;;) {
    try {
      const res = await fetch(url)
      if (res.ok)
        return true
    }
    catch {}
    if (Date.now() - start > timeout)
      return false
    await sleep(200)
  }
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
    if (msg.id == null)
      return
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

/** 改文件 → 等画布出现标记 → 立即还原 */
async function editAndWait(target, snapshot, evaluate) {
  // 连着几步快速改同一个文件时，相邻两次写入可能被文件监听器合并成一次，
  // 开发服务器会认为内容没变而不发 HMR 更新。写之前先让上一步「消化」完。
  await sleep(400)
  const original = await readFile(target.file, 'utf8')
  // 锚点按当前内容定位，避免写死文案：
  // 组件视图用模板里那段占位 div，schema 用「菜单」组件里那个开关的 label
  if (target.from === null) {
    const match = target === VIEW
      ? /<div>[^<]*<\/div>/.exec(original)
      : /label: '(是否显示[^']*)'/.exec(original)
    if (!match)
      throw new Error(`锚点不存在：${target.file}`)
    target.from = match[0]
    target.to = target === VIEW
      ? `<div>${VIEW.needle}</div>`
      : `label: '${SCHEMA.needle}'`
  }
  if (!original.includes(target.from))
    throw new Error(`锚点不存在：${target.file} 里的 ${JSON.stringify(target.from)}`)

  await evaluate(`window.__HMR_E2E_SENTINEL__ = 'alive'`)
  const at = Date.now()
  await writeFile(target.file, original.replace(target.from, target.to))
  try {
    // 宿主的源码由 vite 即时编译，这里确认开发服务器已经拿到了新代码
    const served = target.servedUrl
      ? await evaluate(`fetch(${JSON.stringify(target.servedUrl)} + '?t=' + Date.now()).then(r => r.text()).then(t => t.includes(${JSON.stringify(target.needle)}))`).catch(() => null)
      : null
    let needleAt = null
    let reloaded = false
    const deadline = Date.now() + 15000
    while (Date.now() < deadline) {
      const state = await snapshot()
      if (state.sentinel === null)
        reloaded = true
      if (state.hasNeedle) {
        needleAt = Date.now() - at
        break
      }
      await sleep(200)
    }
    return { needleAt, reloaded, served }
  }
  finally {
    await writeFile(target.file, original)
  }
}

const viteBin = join(ROOT, 'packages/editor/node_modules/.bin/vite')
const rsbuildBin = join(ROOT, 'packages/widgets/node_modules/.bin/rsbuild')

let chrome
let cdp
try {
  for (const bin of [viteBin, rsbuildBin]) {
    if (!existsSync(bin))
      throw new Error(`缺少可执行文件 ${bin}，请先安装依赖`)
  }
  if (!existsSync(join(ROOT, 'packages/editor/dist/editor.js')))
    throw new Error('缺少 packages/editor/dist/editor.js，请先执行 pnpm -C packages/editor build:dev')
  if (!CHROME)
    throw new Error('未找到 chromium，请先安装 playwright chromium 或系统 chromium')

  const widgetPort = await freePort()
  const editorPort = await freePort()

  const producer = startProcess(rsbuildBin, ['dev', '--port', String(widgetPort)], join(ROOT, 'packages/widgets'))
  const host = startProcess(viteBin, ['--port', String(editorPort), '--strictPort'], join(ROOT, 'packages/editor'))

  const producerReady = await waitForUrl(`http://localhost:${widgetPort}/mf-manifest.json`)
  const hostReady = await waitForUrl(`http://localhost:${editorPort}/`)
  if (!producerReady || !hostReady) {
    // 开发服务器起不来时把日志打出来，方便定位
    console.log(producer.output().slice(-2000))
    console.log(host.output().slice(-2000))
    throw new Error(`开发服务器未就绪（producer=${producerReady}, host=${hostReady}）`)
  }

  await rm(PROFILE_DIR, { recursive: true, force: true })
  chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--no-first-run',
    '--no-default-browser-check',
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
        throw new Error('chromium devtools 未就绪')
      await sleep(200)
    }
  }
  const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
  const page = targets.find(t => t.type === 'page')
  cdp = await connectCDP(page.webSocketDebuggerUrl)

  const evaluate = async (expression) => {
    const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (res.exceptionDetails)
      throw new Error(`页面执行失败：${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`)
    return res.result?.value
  }

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  // ?remote= 让宿主连到本次临时起的生产者（默认 8090 可能已被别的进程占用）
  await cdp.send('Page.navigate', { url: `http://localhost:${editorPort}/?remote=http://localhost:${widgetPort}` })

  const mountedStart = Date.now()
  for (;;) {
    if (await evaluate(`!!document.querySelector('mpd-editor')?.shadowRoot`))
      break
    if (Date.now() - mountedStart > 30000)
      throw new Error('编辑器没有挂载起来')
    await sleep(300)
  }
  await sleep(2000)

  // 通过宿主页面的按钮写入一份数据，热更新前后都对着它比较
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'set config')?.click()`)
  await sleep(1200)
  const selectNode = () => evaluate(`(() => {
    const sr = document.querySelector('mpd-editor')?.shadowRoot
    const node = sr?.querySelector('.mpd-node .node-wrap')
    node?.click()
    return !!node
  })()`)
  await selectNode()
  await sleep(600)

  const snapshot = () => evaluate(`(() => {
    const sr = document.querySelector('mpd-editor')?.shadowRoot
    return {
      nodes: sr ? sr.querySelectorAll('.mpd-node').length : -1,
      text: sr ? sr.textContent : '',
      hostText: document.body.innerText,
      config: [...document.querySelectorAll('pre')].map(p => p.textContent).join(' | '),
      sentinel: window.__HMR_E2E_SENTINEL__ ?? null,
    }
  })()`)

  /** 画布 + 宿主页面的一次快照；needle 用来判断某段新代码是否已经生效 */
  const stateOf = async (needle = '') => {
    const state = await snapshot()
    return { ...state, hasNeedle: state.text.includes(needle), text: undefined }
  }
  /** 只看宿主页面（light DOM）里的文本，用于验证改动的是宿主自己的模板 */
  const hostStateOf = async (needle = '') => {
    const state = await snapshot()
    return { ...state, hasNeedle: state.hostText.includes(needle), hostText: undefined }
  }

  const before = await stateOf()
  check('编辑器挂载并写入测试数据', before.nodes === 1, `nodes=${before.nodes}`)

  // 记录全局 Vue HMR 运行时的调用，并给当前的自定义元素做个标记，
  // 用来判断业务侧热更新之后编辑器是「原地更新」还是「卸载重挂」
  await evaluate(`(() => {
    const rt = window.__VUE_HMR_RUNTIME__
    window.__HMR_E2E_CALLS__ = []
    for (const fn of ['createRecord', 'reload', 'rerender']) {
      const orig = rt[fn]
      rt[fn] = function (...args) {
        window.__HMR_E2E_CALLS__.push(fn + ':' + String(args[0]))
        return orig.apply(this, args)
      }
    }
    document.querySelector('mpd-editor').__hmrE2eMarked = true
    // 宿主页面里的 'topbar'（Home.vue 模板的第一个节点）也做标记，
    // 用来区分「宿主组件被重建」还是「只有编辑器被重挂」
    const topbar = [...document.querySelectorAll('#app div')].find(d => d.textContent.trim() === 'topbar')
    if (topbar) topbar.__hmrE2eMarked = true
  })()`)

  // 1. 改生产者的组件视图
  if (!process.env.HMR_E2E_SKIP?.includes('view')) {
    const viewResult = await editAndWait(VIEW, () => stateOf(VIEW.needle), evaluate)
    const afterView = await stateOf(VIEW.needle)
    check('改组件视图：画布原地更新（HMR 生效）', afterView.hasNeedle, `用时 ${viewResult.needleAt}ms`)
    check('改组件视图：编辑中的数据保留', afterView.nodes === 1, `nodes=${afterView.nodes}`)
    check('改组件视图：没有整页刷新', !viewResult.reloaded && afterView.sentinel === 'alive')
  }

  // 1.2 只改生产者的样式：验证 shadow root 里的样式表能被 CSS HMR 找到并原地更新
  if (!process.env.HMR_E2E_SKIP?.includes('viewstyle')) {
    const styleOriginal = await readFile(VIEW_STYLE.file, 'utf8')
    if (!styleOriginal.includes(VIEW_STYLE.from))
      throw new Error(`样式锚点不存在：${VIEW_STYLE.file} 里的 ${VIEW_STYLE.from}`)

    const colorOf = () => evaluate(`(() => {
      const wrapper = document.querySelector('mpd-editor')?.shadowRoot?.querySelector('.menu-item-wrapper')
      return {
        color: wrapper ? getComputedStyle(wrapper).color : null,
        sentinel: window.__HMR_E2E_SENTINEL__ ?? null,
      }
    })()`)

    await evaluate(`window.__HMR_E2E_SENTINEL__ = 'alive'`)
    await sleep(400)
    const styleAt = Date.now()
    await writeFile(VIEW_STYLE.file, styleOriginal.replace(VIEW_STYLE.from, VIEW_STYLE.to))
    try {
      let styleUpdated = false
      const styleDeadline = Date.now() + 15000
      while (Date.now() < styleDeadline) {
        if ((await colorOf()).color === VIEW_STYLE.expect) {
          styleUpdated = true
          break
        }
        await sleep(200)
      }
      const afterStyle = await colorOf()
      check('改组件视图样式：画布样式原地更新（CSS HMR 生效）', styleUpdated, `color=${afterStyle.color} 用时 ${Date.now() - styleAt}ms`)
      check('改组件视图样式：没有整页刷新', afterStyle.sentinel === 'alive')
    }
    finally {
      await writeFile(VIEW_STYLE.file, styleOriginal)
    }
  }

  // 1.5 改宿主自己的模板：验证宿主页面本身的 HMR 也照常工作（编辑器不吞掉宿主的更新）
  const templateResult = await editAndWait(HOST_TEMPLATE, () => hostStateOf(HOST_TEMPLATE.needle), evaluate)
  const afterTemplate = await hostStateOf(HOST_TEMPLATE.needle)
  check('改宿主模板：页面文本原地更新', afterTemplate.hasNeedle, `用时 ${templateResult.needleAt}ms`)

  // 2. 改业务侧的组件配置（schema）
  const schemaResult = await editAndWait(SCHEMA, () => stateOf(SCHEMA.needle), evaluate)
  const afterSchema = await stateOf(SCHEMA.needle)
  check('改 schema：编辑器数据不被清空', afterSchema.nodes === 1, `nodes=${afterSchema.nodes}`)
  check('改 schema：没有整页刷新', !schemaResult.reloaded && afterSchema.sentinel === 'alive')
  check('改 schema：宿主侧的数据同步回来了', afterSchema.config.includes('menuItem'), afterSchema.config.slice(0, 60).replace(/\n/g, ' '))
  const remounted = await evaluate(`document.querySelector('mpd-editor')?.__hmrE2eMarked !== true`)
  const hmrCalls = await evaluate(`window.__HMR_E2E_CALLS__`)
  const hostRecreated = await evaluate(`(() => {
    const topbar = [...document.querySelectorAll('#app div')].find(d => d.textContent.trim() === 'topbar')
    return !topbar || topbar.__hmrE2eMarked !== true
  })()`)
  // 宿主这条链路上到底有没有拿到新 schema？顺着宿主 app 的组件树找 Home 的 setupState.widgets
  const hostWidgetsFresh = await evaluate(`(() => {
    const app = document.querySelector('#app').__vue_app__
    const walk = (vnode, depth = 0) => {
      if (!vnode || depth > 12) return null
      const inst = vnode.component
      if (inst) {
        const widgets = inst.setupState && inst.setupState.widgets
        if (widgets) return JSON.stringify(widgets).includes(${JSON.stringify(SCHEMA.needle)})
        const found = walk(inst.subTree, depth + 1)
        if (found !== null && found !== undefined) return found
      }
      const children = vnode.children
      if (Array.isArray(children)) {
        for (const child of children) {
          const found = walk(child, depth + 1)
          if (found !== null && found !== undefined) return found
        }
      }
      return null
    }
    const res = walk(app._instance.subTree)
    return res === null ? 'not-found' : res
  })()`)
  console.log(`  · 热更新调用：${(hmrCalls || []).join(', ')}`)
  console.log(`  · 宿主组件${hostRecreated ? '被重建' : '原地保留'}；编辑器${remounted ? '重新挂载（数据来自快照）' : '原地更新'}；vite 已提供新代码=${schemaResult.served}`)
  console.log(`  · 宿主 widgets 里是否含新 label：${hostWidgetsFresh}`)

  // 重新选中节点，确认配置面板已经用上新定义的 label
  await selectNode()
  await sleep(800)
  const afterReselect = await stateOf(SCHEMA.needle)
  const panelInfo = await evaluate(`(() => {
    const sr = document.querySelector('mpd-editor').shadowRoot
    return {
      crumb: sr.querySelector('.mpd-breadcrumb')?.textContent?.trim() || '',
      form: (sr.querySelector('.mpd-form')?.textContent || '').replace(/\\s+/g, ' ').slice(0, 120),
      selected: sr.querySelector('.mpd-node.selected')?.getAttribute('data-name') || '',
    }
  })()`)
  check('改 schema：配置面板用上新定义', afterReselect.hasNeedle,
    `选中=${panelInfo.selected} 面包屑=${panelInfo.crumb} 面板=${panelInfo.form}`)
}
finally {
  try {
    cdp?.close()
  }
  catch {}
  try {
    chrome?.kill('SIGKILL')
  }
  catch {}
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    }
    catch {}
  }
  await rm(PROFILE_DIR, { recursive: true, force: true }).catch(() => {})
}

console.log('------------------------------------------')
const failed = results.filter(item => !item.ok)
if (failed.length) {
  console.log(`✗ ${failed.length}/${results.length} 项未通过：${failed.map(item => item.name).join('；')}`)
  process.exit(1)
}
console.log(`✓ 全部 ${results.length} 项通过`)
