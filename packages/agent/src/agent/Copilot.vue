<template>
  <div class="assistant-root">
    <section
      v-if="open"
      class="assistant-panel"
      aria-label="DIY Copilot"
    >
      <ChatView
        :key="`${sessionId}-${model}`"
        mode="data"
        :title="title"
        :description="description"
        :placeholder="placeholder"
        :examples="examples"
        :session-id="sessionId"
        :storage-namespace="storageKey"
        :runtime="runtime"
        embedded
        @running="isRunning = $event"
      />
    </section>
    <button
      class="assistant-button"
      type="button"
      :aria-expanded="open"
      :aria-label="open ? '收起装修助手' : '打开装修助手'"
      @click="open = !open"
    >
      <span>装修助手</span>
      <span
        class="dot"
        :class="{ ok: isRunning }"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AgentToolDefinition } from '../tool'
import type { AgentHostApi } from '../types'
import { computed, ref } from 'vue'
import ChatView from '../components/ChatView.vue'
import { createAgentRuntime } from '../runtime'

const props = withDefaults(defineProps<{
  api?: AgentHostApi
  tools?: AgentToolDefinition[]
  context?: () => Record<string, unknown>
  sessionId?: string
  storageKey?: string
  title?: string
  description?: string
  placeholder?: string
}>(), {
  api: () => ({}),
  tools: () => [],
  sessionId: '',
  storageKey: 'dnd-agent-chat',
  title: 'DIY Copilot',
  description: '通过宿主 API 与业务工具完成页面设计。',
  placeholder: '描述你想设计的页面...',
})

const generatedSessionId = crypto.randomUUID()
const sessionId = computed(() => props.sessionId.trim() || generatedSessionId)
const model = computed(() => props.api.model?.model || 'qwen3.6-flash')
const runtime = computed(() => createAgentRuntime({
  baseURL: props.api.model?.baseURL,
  model: props.api.model?.model,
  apiMode: props.api.model?.apiMode,
  api: props.api,
  tools: props.tools,
  getContext: props.context,
}))

const examples = [
  '帮我设计一个租房产品首页',
  '这个页面如何优化布局？',
  '查询一下当前场景的开通状态',
]

const open = ref(false)
const isRunning = ref(false)
</script>

<style src="../styles/chat.css"></style>

<style scoped>
.assistant-root {
  position: fixed;
  z-index: 2147483000;
  right: 10px;
  bottom: 24px;
  display: flex;
  align-items: stretch;
  gap: 12px;
  justify-content: flex-end;
  pointer-events: auto;
}

.assistant-button {
  display: inline-flex;
  flex-shrink: 0;
  align-self: flex-end;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: #1677ff;
  box-shadow: 0 8px 20px rgb(22 119 255 / 35%);
  cursor: pointer;
}

.assistant-button .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ffccc7;
}

.assistant-button .dot.ok {
  background: #b7eb8f;
}

.assistant-panel {
  display: flex;
  overflow: hidden;
  width: min(440px, calc(100vw - 24px));
  height: min(700px, calc(100vh - 104px));
  min-height: min(420px, calc(100vh - 104px));
  flex-direction: column;
  padding: 18px;
  border: 1px solid #242830;
  border-radius: 18px;
  background:
    radial-gradient(
      700px 320px at 8% -8%,
      rgb(48 76 137 / 38%) 0%,
      rgb(11 12 16 / 0%) 64%
    ),
    #0b0c10;
  box-shadow: 0 16px 40px rgb(0 0 0 / 28%);
}

.assistant-panel :deep(.chat-view) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.assistant-panel :deep(.chat-panel) {
  min-height: 0;
  flex: 1;
}

.assistant-panel :deep(.message-list) {
  min-height: 0;
  flex: 1;
}

.assistant-panel :deep(.empty-state) {
  margin-block: auto;
}

@media (max-width: 560px) {
  .assistant-root {
    right: 8px;
    bottom: 16px;
    gap: 8px;
  }

  .assistant-panel {
    position: fixed;
    right: 8px;
    bottom: 76px;
    width: calc(100vw - 16px);
    height: calc(100vh - 96px);
    min-height: 0;
    padding: 12px;
  }

  .assistant-button {
    padding: 10px 14px;
  }
}
</style>
