<template>
  <div class="playground">
    <Copilot />
  </div>
</template>

<script setup lang="ts">
import type { ModelConfig } from './responders'
import { computed, reactive, ref, triggerRef, watch } from 'vue'
import { Agent } from '@/agent/Agent'
import ChatPanel from './ChatPanel.vue'
import { createMockResponder, createOpenAIResponder, defaultModelConfig } from './responders'
import Copilot from '@/agent/Copilot.vue'

const STORAGE_KEY = 'agent-playground:model'

const tabs = [
  { id: 'runtime', label: '运行时' },
  { id: 'model', label: '模型' },
] as const

// const agent = new Agent()
const activeTab = ref<'runtime' | 'model'>('runtime')
const mode = ref<'mock' | 'openai'>('mock')
const config = reactive<ModelConfig>(loadConfig())

const isRunning = ref(true)
// const messageCount = computed(() => agent.runtime.messages.value.length)
// const snapshot = computed(() => {
//   // 依赖 messages ref，triggerRef 后能刷新快照
//   return JSON.stringify(agent.runtime.messages.value, null, 2)
// })

const responder = computed(() => {
  return mode.value === 'mock' ? createMockResponder() : createOpenAIResponder()
})

watch(config, persistConfig, { deep: true })

function loadConfig(): ModelConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw)
      return { ...defaultModelConfig, ...JSON.parse(raw) }
  }
  catch {
    // ignore malformed storage
  }

  return { ...defaultModelConfig }
}

function persistConfig() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

function reset() {
  agent.runtime.messages.value = []
  agent.runtime.isRunning.value = false
  triggerRef(agent.runtime.messages)
}
</script>
