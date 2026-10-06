import { z } from 'zod'
import { AgentRuntime } from '../src/agent/runtime'
import { defineCapability } from '../src/agent/capability'
import { defineWorkflow } from '../src/agent/workflow'
import { structuredExtract } from '../src/agent/extract'
import { setMockClient } from '../src/agent/core/sdk'

const businessConfigSchema = z.object({
  scenes: z.array(z.object({ name: z.string(), fee: z.string().nullable() })),
})

const checkScenario = defineCapability({
  name: 'check_scenario',
  description: '检查指定场景是否已经开通',
  inputSchema: z.object({ scenarios: z.array(z.object({ name: z.string() })) }),
  async execute(input: { scenarios: Array<{ name: string }> }) {
    return input.scenarios.map(scene => ({ name: scene.name, enabled: true }))
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
          instructions: '解析用户输入中的场景。',
          input: String(context.input),
        })
      },
    },
    {
      name: 'normalizeScenario',
      async execute(context) {
        const config = context.state.parseScenario as any
        return ['scenes'].flatMap((kind) => {
          const list = config?.[kind] ?? []
          return list.length ? [{ kind, items: list }] : []
        })
      },
    },
  ],
})

function mockRespond(sys: string, lastUser: string, hasToolResult: boolean) {
  if (sys.includes('顶层流程路由')) {
    const flow = /检查|查询|开通|是否|有没有/.test(lastUser) ? 'capability' : 'initialize'
    return { text: JSON.stringify({ flow }) }
  }
  if (sys.includes('JSON Schema')) {
    return {
      text: JSON.stringify({
        scenes: [
          { name: '大润发小时达', fee: '2%' },
          { name: '盒马鲜生', fee: '2%' },
        ],
      }),
    }
  }
  if (sys.includes('布局 IR 生成器')) {
    return {
      text: JSON.stringify({
        layout: [{
          widget: 'jqg',
          items: [
            { category: 'scenes', id: 0 },
            { category: 'scenes', id: 1 },
          ],
        }],
      }),
    }
  }
  if (sys.includes('编辑器操作 Agent')) {
    return { text: JSON.stringify({ edits: [] }) }
  }
  if (sys.includes('业务能力调用 Agent')) {
    if (hasToolResult) {
      return { text: '检查完成：大润发小时达已开通。' }
    }
    return {
      toolCalls: [{
        id: 'call-1',
        name: 'check_scenario',
        args: JSON.stringify({ scenarios: [{ name: '大润发小时达' }] }),
      }],
    }
  }
  return { text: '' }
}

function mockStream(response: { text?: string, toolCalls?: Array<{ id: string, name: string, args: string }> }) {
  const chunks: any[] = []
  if (response.text) {
    chunks.push({
      id: 'mock-id',
      choices: [{ index: 0, delta: { content: response.text } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
  }
  for (const tc of response.toolCalls ?? []) {
    chunks.push({
      id: 'mock-id',
      choices: [{
        index: 0,
        delta: { tool_calls: [{ index: 0, id: tc.id, function: { name: tc.name, arguments: tc.args } }] },
      }],
    })
  }
  let i = 0
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => (i < chunks.length ? { value: chunks[i++], done: false } : { value: undefined, done: true }),
      }
    },
  }
}

function mockNonStream(response: { text?: string, toolCalls?: Array<{ id: string, name: string, args: string }> }) {
  return {
    id: 'mock-id',
    choices: [{
      index: 0,
      message: {
        content: response.text ?? null,
        tool_calls: response.toolCalls?.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args },
        })),
      },
    }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }
}

setMockClient({
  chat: {
    completions: {
      create: async (params: any) => {
        const messages: any[] = params.messages ?? []
        const sys = messages.find(m => m.role === 'system')?.content ?? ''
        const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
        const hasToolResult = messages.some(m => m.role === 'tool')
        const response = mockRespond(sys, lastUser, hasToolResult)
        return params.stream ? mockStream(response) : mockNonStream(response)
      },
    },
  },
} as any)

async function main() {
  const runtime = new AgentRuntime({
    capabilities: [checkScenario],
    workflows: [initializeWorkflow],
    context: () => ({ widgets: [{ typeId: 'jqg', description: '紧凑网格', layout: {} }] }),
  })

  const events: string[] = []
  const collect = (event: any) => events.push(event.type)

  console.log('=== Turn 1: initialize ===')
  const r1 = await runtime.run('生成一个包含盒马鲜生和大润发小时达的页面', { onEvent: collect })
  console.log('  r1.flow =', r1.flow)
  console.log('  r1.layout =', JSON.stringify(r1.layout))

  console.log('=== Turn 2: capability ===')
  const r2 = await runtime.run('检查一下大润发小时达是否开通', { onEvent: collect })
  console.log('  r2.flow =', r2.flow)
  console.log('  r2.capability =', JSON.stringify(r2.capability))
  console.log('  r2.text =', r2.text)

  console.log('  events =', events.join(', '))

  const ok
    = r1.flow === 'initialize'
      && Array.isArray(r1.layout) && r1.layout.length > 0
      && r2.flow === 'capability'
      && r2.capability?.name === 'check_scenario'
      && events.includes('text-delta')
      && events.includes('tool-call')
      && events.includes('workflow-start')

  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL')
  if (!ok) {
    process.exitCode = 1
  }
}

main()
