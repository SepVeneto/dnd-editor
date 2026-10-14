/**
 * 构建产物守卫：库产物里不能出现 `__VUE_HMR_RUNTIME__`。
 *
 * 内联的 `vue` 一旦保留 dev 分支，就会在宿主里执行
 * `getGlobalThis().__VUE_HMR_RUNTIME__ = { ... }`，用自己的 HMR 运行时顶掉宿主的，
 * 宿主的 `.vue` 热更新随即静默失效（原因见 `../vite.externals.ts` 的 `agentDefine`）。
 * 这里是防回归检查，跟着 `build` 一起跑。
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FORBIDDEN = ['__VUE_HMR_RUNTIME__']
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')

const files = readdirSync(distDir).filter(file => file.endsWith('.js'))
const hits = []

for (const file of files) {
  const code = readFileSync(join(distDir, file), 'utf8')
  for (const token of FORBIDDEN) {
    if (code.includes(token))
      hits.push(`${file} 命中 ${token}`)
  }
}

if (hits.length) {
  console.error('[check-dist] 产物会污染宿主运行环境：')
  for (const hit of hits)
    console.error(`  - ${hit}`)
  console.error('[check-dist] 检查 vite.config.*.ts 的 define / external 配置。')
  process.exit(1)
}

console.log(`[check-dist] ok（${files.join('、')}）`)
