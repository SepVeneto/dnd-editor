<template>
  <div class="playground">
    <Copilot
      :api="api"
      :sub-agents="subAgents"
      :context="context"
    />
  </div>
</template>

<script setup lang="ts">
import type { AgentHostApi, AgentSubAgent } from '@/index'
import Copilot from '@/agent/Copilot.vue'
import {
  Agent,
  createEditorDslTools,
  tool,
} from '@/index'

const api: AgentHostApi = {
  model: {
    baseURL: 'http://localhost:4000/v1',
    model: 'qwen3.6-plus',
    apiMode: 'responses',
  },
  editor: {
    getCurrentEditor: () => ({ page: { id: 'root', children: [] } }),
    getWidgets: () => [{ typeId: 'page', name: '页面' }],
    validateDsl: () => ({ ok: true, issues: [] }),
    applyDsl: dsl => ({ ok: true, dsl }),
  },
}

const checkScenario = tool({
  name: 'check_scenario',
  description: '检查指定场景是否已经开通',
  parameters: {
    type: 'object',
    properties: {
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
          additionalProperties: false,
        },
      },
    },
    required: ['scenarios'],
    additionalProperties: false,
  },
  strict: false,
  async execute(input) {
    const { scenarios } = input as { scenarios: Array<{ name: string }> }
    return scenarios.map(scene => ({ name: scene.name, opened: true }))
  },
})

const editorTools = createEditorDslTools(api)

const pageAgent = new Agent({
  name: 'Page Agent',
  handoffDescription: '处理页面编辑和业务查询请求。',
  model: 'qwen3.6-plus',
  instructions: [
    '先读取当前编辑器与组件能力目录。',
    '只能通过 apply_editor_dsl 提交完整、版本化的编辑器 DSL。',
    '完成后直接结束并返回处理结果。',
  ].join('\n'),
  tools: [
    ...editorTools,
    checkScenario,
  ],
})

const subAgents: AgentSubAgent[] = [pageAgent]

const context = () => ({ widgets: [] })
</script>
