import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { AgentRuntime } from '../src/agent/runtime'
import { defineCapability, invokeCapability } from '../src/agent/capability'
import { defineWorkflow } from '../src/agent/workflow'
import { structuredExtract } from '../src/agent/extract'

// 与 Home.vue 业务侧一致的三类配置。
const businessConfigSchema = z.object({
  scenes: z.array(z.object({ name: z.string(), fee: z.string().nullable() })),
  brand: z.array(
    z.object({
      name: z.string(),
      coupon: z.string().nullable(),
      faceValue: z.number().nullable(),
      fee: z.string().nullable(),
    }),
  ),
  shopPickup: z.array(z.object({ name: z.string(), scope: z.array(z.string()).optional() })),
})

const checkScenario = defineCapability({
  name: 'check_scenario',
  description: '查询业务系统中指定场景的开通状态，只查询不修改。',
  inputSchema: z.object({ scenarios: z.array(z.object({ name: z.string() })) }),
  async execute(input: { scenarios: Array<{ name: string }> }) {
    console.log('  [check_scenario] called with', JSON.stringify(input))
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    return input.scenarios.map((item) => {
      const target = resJson.data.find((each: any) => each.name === item.name)
      if (!target) {
        throw new Error(`cannot find scene ${item.name}`)
      }
      return { id: target.id, name: target.name, enabled: !!target.status }
    })
  },
})

const enableScenario = defineCapability({
  name: 'enable_scenario',
  description: '开通业务系统中指定的场景。',
  inputSchema: z.object({ id: z.number(), name: z.string() }),
  needsApproval: true,
  approval: {
    message: (input: { id: number, name: string }) => `场景「${input.name}」未开通，是否需要开通？`,
  },
  async execute(input: { id: number, name: string }) {
    const res = await fetch('http://localhost:4000/v1/business/scene', { method: 'post' })
    const resJson = await res.json()
    if (resJson.code !== 0) {
      throw new Error(resJson.message ?? `场景 ${input.name} 开通失败`)
    }
    return { id: input.id, name: input.name, enabled: true }
  },
})

const initializeWorkflow = defineWorkflow({
  name: 'initialize',
  description: '根据用户输入初始化页面。',
  steps: [
    {
      name: 'parseScenario',
      async execute(context) {
        return structuredExtract({
          schema: businessConfigSchema,
          instructions: `你是业务配置解析器。解析用户提供的文本，输出三类配置：
- H5外接场景：scenes [{ name, fee }]
- 品牌商户：brand [{ name, coupon, faceValue, fee }]
- 扫码提货：shopPickup [{ name, scope }]
只解析用户提供的信息，未提供的字段用 null。`,
          input: String(context.input),
        })
      },
    },
    {
      name: 'verifyScenario',
      async execute(context) {
        const parsed = context.state.parseScenario as any
        const scenarios = (parsed?.scenes ?? []).map((item: any) => ({ name: item.name }))
        if (!scenarios.length) {
          return parsed
        }
        const result = await invokeCapability(checkScenario, { scenarios }, context)
        for (const scene of result as Array<{ id: number, name: string, enabled: boolean }>) {
          if (!scene.enabled) {
            try {
              await invokeCapability(enableScenario, { id: scene.id, name: scene.name }, context)
            }
            catch {
              // 拒绝开通则跳过
            }
          }
        }
        return parsed
      },
    },
    {
      name: 'normalizeScenario',
      async execute(context) {
        const config = (context.state.verifyScenario ?? context.state.parseScenario) as any
        return ['scenes', 'brand', 'shopPickup'].flatMap((kind) => {
          const list = config?.[kind] ?? []
          return list.length
            ? [{ kind, items: list.map((item: any, index: number) => ({ name: item.name, id: index })) }]
            : []
        })
      },
    },
  ],
})

async function main() {
  const input = readFileSync(new URL('../src/agent/mock.txt', import.meta.url), 'utf-8')

  const runtime = new AgentRuntime({
    capabilities: [checkScenario, enableScenario],
    workflows: [initializeWorkflow],
    context: () => ({
      widgets: [
        { typeId: 'jqg', description: '紧凑规则网格。适合大量同类元素，需要提高信息密度。', layout: { direction: 'row', density: 'high', priority: 'large' } },
        { typeId: 'picture', description: '较大的独立展示区域。适合少量元素，突出展示。', layout: { direction: 'row', density: 'low', priority: 'large' } },
        { typeId: 'menuItem', description: '菜单组件，展示菜单项。', layout: { direction: 'row', density: 'medium', priority: 'large' } },
      ],
    }),
  })

  const onApproval = async (req: any) => {
    console.log('  [approval]', req.message, '-> 同意')
    return true
  }

  console.log('=== initialize with mock.txt ===')
  const r1 = await runtime.run(input, {
    onEvent: e => console.log('  event:', e.type),
    onApproval,
  })
  console.log('  r1.flow =', r1.flow)
  console.log('  r1.layout =', JSON.stringify(r1.layout, null, 2))

  console.log('=== turn 2: 盒马开通了吗 ===')
  const r2 = await withTimeout(
    runtime.run('盒马开通了吗', {
      onEvent: e => console.log('  event:', e.type),
      onApproval,
    }),
    60000,
    'turn2',
  )
  console.log('  r2.flow =', r2.flow)
  console.log('  r2.capability =', JSON.stringify(r2.capability))
  console.log('  r2.text =', r2.text)

  console.log('=== turn 3: 开通大润发小时达（应触发审批）===')
  const r3 = await withTimeout(
    runtime.run('帮我把大润发小时达开通', {
      onEvent: e => console.log('  event:', e.type),
      onApproval,
    }),
    60000,
    'turn3',
  )
  console.log('  r3.flow =', r3.flow)
  console.log('  r3.capability =', JSON.stringify(r3.capability))
  console.log('  r3.text =', r3.text)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ])
}

main().catch((err) => {
  console.error('E2E FAILED:', err)
  process.exit(1)
})
