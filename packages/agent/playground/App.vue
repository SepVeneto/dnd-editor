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
import type { AgentHostApi, AgentSubAgentDefinition, AgentToolDefinition } from '@/index'
import { z } from 'zod'
import Copilot from '@/agent/Copilot.vue'
import { defineAgentTool } from '@/index'

const tools: AgentToolDefinition<any, any>[] = [
  defineAgentTool({
    name: 'check_scenario',
    description: '检查指定场景是否已经开通',
    parameters: z.object({
      scenarios: z.array(z.object({ name: z.string() })),
    }),
    async execute(input: { scenarios: Array<{ name: string }> }) {
      return input.scenarios.map(scene => ({ name: scene.name, opened: true }))
    },
  }),
]

const subAgents: AgentSubAgentDefinition[] = [{
  name: 'Page Agent',
  handoffDescription: '处理页面编辑和业务查询请求。',
  handoffToolName: 'handle_page',
  instructions: [
    '先读取当前编辑器与组件能力目录。',
    '只能通过 apply_editor_dsl 提交完整、版本化的编辑器 DSL。',
    '完成后调用 return_to_main_agent 交还控制权。',
  ].join('\n'),
  tools,
}]

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

const context = () => ({ widgets: [] })
</script>
