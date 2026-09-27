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
const PORT = 8082
const CDP_PORT = 9333
const ORIGIN = `http://127.0.0.1:${PORT}`
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
  check('生产者 setup 经模块联邦加载（element-plus 样式已注入 shadow dom）', state.styleHasElCss === true, `style 标签数=${state.styleTagCount}`)
  check('生产者视图在 shadow dom 内渲染 element-plus 组件', state.hasElImage === true)
  const unresolved = (state.warnings || []).filter(w => /resolve component/i.test(w))
  check('无「Failed to resolve component」告警', unresolved.length === 0, unresolved.join(' | '))
  check('页面无未捕获错误', state.phase === 'done' && (state.errors || []).length === 0, (state.errors || []).join(' | '))

  // element-plus 单例的行为级证明：namespace(mpd) 经由 element-plus 内部的 injection key 传递，
  // 只有宿主与远端是同一模块实例时，远端组件才会带上 mpd- 前缀
  check(
    '远端 element-plus 组件使用宿主 namespace(mpd-)：证明共用同一实例',
    /mpd-image/.test(state.cardImgClass || ''),
    `img class=${state.cardImgClass}`,
  )

  const instances = state.federation?.instances || []
  const ep = instances.flatMap(i => (i.elementPlus || []).map(v => `${i.name}@${v}`))
  check(
    'element-plus 由宿主提供、被远端消费（provider.from === editor）',
    state.federation?.elementPlusFrom === 'editor',
    `from=${state.federation?.elementPlusFrom}, instances=${ep.join(',')}`,
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
