<template>
  <div class="playground">
    <Copilot
      :capabilities="capabilities"
      :workflows="workflows"
      :context="context"
    />
  </div>
</template>

<script setup lang="ts">
import Copilot from '@/agent/Copilot.vue'
import {
  defineCapability,
  defineWorkflow,
  structuredExtract,
  z,
} from '@/index'

const capabilities = [
  defineCapability({
    name: 'check_scenario',
    description: '检查指定场景是否已经开通',
    inputSchema: z.object({
      scenarios: z.array(z.object({ name: z.string() })),
    }),
    async execute(input: { scenarios: Array<{ name: string }> }) {
      return input.scenarios.map(scene => ({ name: scene.name, opened: true }))
    },
  }),
]

const parseSchema = z.object({
  scenes: z.array(z.object({ name: z.string() })),
})

const workflows = [
  defineWorkflow({
    name: 'initialize',
    description: '根据用户输入初始化页面。',
    steps: [
      {
        name: 'parseScenario',
        async execute(context) {
          return structuredExtract({
            schema: parseSchema,
            instructions: '抽取用户提到的场景名称，输出 { scenes: [{ name }] }。',
            input: String(context.input),
            onEvent: context.onAgentEvent,
          })
        },
      },
    ],
  }),
]

const context = () => ({ widgets: [] })
</script>
