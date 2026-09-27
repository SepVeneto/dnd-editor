#!/usr/bin/env node
/**
 * 用 Playwright 验证 fixed(header / footer) 的拖拽行为。
 *
 * 页面根节点下是 [header(fixed) , a , b , footer(fixed)]，用真实鼠标拖拽做对照实验：
 *   控制组 ?nofixed=1：去掉 fixed，同样手势能把节点拖到 header 之前 / footer 之后；
 *   fixed 组：同样手势必须被拦截，header 始终在最前、footer 始终在最后。
 *
 * 这样既能证明「手势确实落在了边界上」，又能证明「fixed 规则把它拦住了」。
 *
 * 运行：
 *   node e2e/playwright-fixed.mjs
 * 本机未安装 playwright-core 时，可用环境变量指向已有的 playwright-core：
 *   PLAYWRIGHT_CORE=/path/to/node_modules/playwright-core node e2e/playwright-fixed.mjs
 *
 * 需要先构建：pnpm bootstrap && pnpm -C packages/widgets build
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { homedir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
// 端口交给系统分配，避免与本地 dev server 冲突
const PORT = 0
let ORIGIN = ''
const BASELINE = ['header', 'a', 'b', 'footer']

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

const CHROME = process.env.CHROME_PATH || ['chromium-1234', 'chromium-1228', 'chromium-1208']
  .map(d => join(homedir(), '.cache/ms-playwright', d, 'chrome-linux64/chrome'))
  .concat(['/usr/bin/chromium', '/usr/bin/google-chrome'])
  .find(p => existsSync(p))

function startStaticServer(routes, port) {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
      const entry = Object.entries(routes).find(([prefix]) => {
        if (prefix === '/')
          return true
        return pathname === prefix || pathname.startsWith(`${prefix}/`)
      })
      let rel = entry[0] === '/' ? pathname : pathname.slice(entry[0].length)
      if (rel === '' || rel.endsWith('/'))
        rel += 'index.html'
      const file = join(entry[1], rel)
      const body = await readFile(file)
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
      res.end(body)
    }
    catch {
      res.writeHead(404)
      res.end('not found')
    }
  })
  return new Promise(r => server.listen(port, '127.0.0.1', () => r(server)))
}

async function loadPlaywright() {
  const raw = process.env.PLAYWRIGHT_CORE || 'playwright-core'
  const spec = raw.startsWith('/') && !raw.endsWith('.js') && existsSync(join(raw, 'index.js'))
    ? join(raw, 'index.js')
    : raw
  const mod = await import(spec)
  const pw = mod.default ?? mod
  if (!pw.chromium)
    throw new Error(`无法从 ${spec} 取到 chromium，请确认是 playwright-core`)
  return pw
}

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })
const sleep = ms => new Promise(r => setTimeout(r, ms))

const server = []
let browser
try {
  for (const p of ['packages/editor/dist/editor.js', 'packages/widgets/dist/mf-manifest.json']) {
    if (!existsSync(join(ROOT, p)))
      throw new Error(`缺少构建产物 ${p}，请先执行 pnpm bootstrap 与 pnpm -C packages/widgets build`)
  }
  if (!CHROME)
    throw new Error('未找到 chromium')

  const pw = await loadPlaywright()
  server.push(await startStaticServer({
    '/editor': join(ROOT, 'packages/editor/dist'),
    '/host': join(ROOT, 'e2e/host'),
    '/': join(ROOT, 'packages/widgets/dist'),
  }, PORT))
  ORIGIN = `http://127.0.0.1:${server[0].address().port}`

  browser = await pw.chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })

  async function openEditor(noFixed) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await page.goto(`${ORIGIN}/host/fixed.html${noFixed ? '?nofixed=1' : ''}`)
    await page.waitForFunction(() => window.__E2E__ && window.__E2E__.phase !== 'loading', null, { timeout: 30000 })
    const boot = await page.evaluate(() => window.__E2E__)
    if (boot.phase === 'error')
      throw new Error(`页面初始化失败：${boot.error}`)
    return page
  }

  const order = page => page.evaluate(() => window.__E2E__.getOrder())

  /** 用真实鼠标把 fromId 拖到 toId 高度的 ratio 处（0=顶部，1=底部） */
  async function dragNode(page, fromId, toId, ratio) {
    const rectOf = id => page.evaluate(i => window.__E2E__.rectOf(i), id)
    const from = await rectOf(fromId)
    const to = await rectOf(toId)
    const y = to.top + to.height * ratio

    await page.mouse.move(from.x, from.y)
    await sleep(120)
    await page.mouse.down()
    await sleep(150)
    // 先小幅移动越过 SortableJS 的拖动启动阈值
    await page.mouse.move(from.x, from.y - 12, { steps: 4 })
    await page.mouse.move(from.x, y, { steps: 25 })
    await sleep(300)
    await page.mouse.up()
    await sleep(500)
  }

  async function dragScenario(noFixed, fromId, toId, ratio) {
    const page = await openEditor(noFixed)
    try {
      const before = await order(page)
      await dragNode(page, fromId, toId, ratio)
      const after = await order(page)
      return { before, after }
    }
    finally {
      await page.close()
    }
  }

  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

  // --- 基线 & 基本约束 ---
  {
    const page = await openEditor(false)
    try {
      check('初始顺序为 header,a,b,footer', eq(await order(page), BASELINE), JSON.stringify(await order(page)))
      const draggable = await page.evaluate(() => window.__E2E__.draggableIds())
      check(
        'fixed 的 header / footer 不可被拖拽（没有 draggable class）',
        !draggable.includes('header') && !draggable.includes('footer'),
        `draggable=${JSON.stringify(draggable)}`,
      )
    }
    finally {
      await page.close()
    }
  }

  // --- 正向对照：普通节点可换位 ---
  {
    const { before, after } = await dragScenario(false, 'a', 'b', 0.75)
    check(
      '普通节点之间可以换位（拖拽手势本身有效）',
      eq(before, BASELINE) && eq(after, ['header', 'b', 'a', 'footer']),
      `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    )
  }

  // --- header：控制组能越界，fixed 组必须拦住 ---
  {
    const control = await dragScenario(true, 'b', 'header', 0.5)
    check(
      '控制组（无 fixed）：拖到顶部可以把节点放到 header 之前',
      control.after[0] !== 'header',
      `after=${JSON.stringify(control.after)}`,
    )

    const fixed = await dragScenario(false, 'b', 'header', 0.5)
    check(
      'fixed：不能把节点拖到 header 之前',
      fixed.after[0] === 'header'
      && fixed.after.filter(id => id === 'header').length === 1
      && fixed.after.length === 4,
      `before=${JSON.stringify(fixed.before)} after=${JSON.stringify(fixed.after)}`,
    )
  }

  // --- footer：控制组能越界，fixed 组必须拦住 ---
  {
    const control = await dragScenario(true, 'b', 'footer', 0.5)
    check(
      '控制组（无 fixed）：拖到底部可以把节点放到 footer 之后',
      control.after[control.after.length - 1] !== 'footer',
      `after=${JSON.stringify(control.after)}`,
    )

    const fixed = await dragScenario(false, 'b', 'footer', 0.5)
    check(
      'fixed：不能把节点拖到 footer 之后',
      fixed.after[fixed.after.length - 1] === 'footer',
      `before=${JSON.stringify(fixed.before)} after=${JSON.stringify(fixed.after)}`,
    )
  }
}
catch (err) {
  check('执行未抛异常', false, String((err && err.stack) || err))
}
finally {
  try { await browser?.close() }
  catch {}
  await Promise.all(server.map(s => new Promise(r => s.close(r))))
}

console.log('\n================ Playwright: fixed 行为 ================')
for (const r of results)
  console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.detail ? `  [${r.detail}]` : ''}`)
const failed = results.filter(r => !r.ok)
console.log(`--------------------------------------------------------\n${failed.length ? `✗ ${failed.length}/${results.length} 项失败` : `✓ 全部 ${results.length} 项通过`}`)
process.exitCode = failed.length ? 1 : 0
