/**
 * 构建产物守卫：
 *
 * 1. 库产物里不能出现 `__VUE_HMR_RUNTIME__`；
 * 2. `index` 与 `element` 只能内联一份 `@openai/agents`。
 *
 * 内联的 `vue` 一旦保留 dev 分支，就会在宿主里执行
 * `getGlobalThis().__VUE_HMR_RUNTIME__ = { ... }`，用自己的 HMR 运行时顶掉宿主的，
 * 宿主的 `.vue` 热更新随即静默失效（原因见 `../vite.externals.ts` 的 `agentDefine`）。
 * 这里是防回归检查，跟着 `build` 一起跑。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const FORBIDDEN = ['__VUE_HMR_RUNTIME__']
const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const require = createRequire(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'))
const agentsEntry = require.resolve('@openai/agents')

let agentsPackageDir = dirname(agentsEntry)
while (
  !existsSync(join(agentsPackageDir, 'package.json'))
  || !readFileSync(join(agentsPackageDir, 'package.json'), 'utf8').includes('"name": "@openai/agents"')
) {
  const parent = dirname(agentsPackageDir)
  if (parent === agentsPackageDir)
    throw new Error('[check-dist] 无法定位 @openai/agents 的 package.json')
  agentsPackageDir = parent
}

const agentsVersion = JSON.parse(
  readFileSync(join(agentsPackageDir, 'package.json'), 'utf8'),
).version
const agentsVersionPattern = new RegExp(
  `version\\s*:\\s*["']${agentsVersion.replaceAll('.', '\\.')}["']`,
  'g',
)
const files = readdirSync(distDir, { recursive: true })
  .filter(file => file.endsWith('.js'))
const hits = []
let agentsCopies = 0

for (const file of files) {
  const code = readFileSync(join(distDir, file), 'utf8')
  for (const token of FORBIDDEN) {
    if (code.includes(token))
      hits.push(`${file} 命中 ${token}`)
  }
  agentsCopies += Array.from(code.matchAll(agentsVersionPattern)).length
}

if (hits.length) {
  console.error('[check-dist] 产物会污染宿主运行环境：')
  for (const hit of hits)
    console.error(`  - ${hit}`)
  console.error('[check-dist] 检查 vite.config.*.ts 的 define / external 配置。')
  process.exit(1)
}

if (agentsCopies !== 1) {
  console.error(`[check-dist] @openai/agents@${agentsVersion} 应只内联一份，实际找到 ${agentsCopies} 份。`)
  console.error('[check-dist] 确认 index 与 element 由 vite.config.dist.ts 在同一次构建中产出。')
  process.exit(1)
}

console.log(`[check-dist] ok（${files.length} 个 JS 文件，1 份 @openai/agents@${agentsVersion}）`)
