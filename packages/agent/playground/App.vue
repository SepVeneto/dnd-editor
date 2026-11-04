<template>
  <div class="playground">
    <Copilot
      :api="api"
      :tools="tools"
      :context="context"
    />
  </div>
</template>

<script setup lang="ts">
import type { AgentHostApi, AgentToolDefinition } from '@/index'
import Copilot from '@/agent/Copilot.vue'
import { defineAgentTool } from '@/index'
import { z } from 'zod'

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

const api: AgentHostApi = {
  model: {
    baseURL: 'http://localhost:4000/v1',
    model: 'qwen3.6-plus',
    apiMode: 'responses',
  },
  editor: {
    getCurrentEditor: () => ({ page: { id: 'root', children: [] } }),
    getWidgets: () => [{ typeId: 'page', name: '页面' }],
    operateEditor: operation => ({ ok: true, operation }),
  },
}

const context = () => ({ widgets: [] })
</script>
