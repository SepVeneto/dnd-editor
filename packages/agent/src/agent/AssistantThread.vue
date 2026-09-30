<template>
  <section class="thread">
    <header class="thread__header">
      <span class="thread__dot" :class="{ 'thread__dot--busy': isRunning }" />
      <h3>装修助手</h3>
      <span class="thread__status">{{ isRunning ? '正在生成…' : '在线' }}</span>
    </header>

    <div ref="viewport" class="thread__viewport">
      <p v-if="!messages.length" class="thread__empty">
        用一句话把信息说清楚：字段值会变成表单上的 Action，需要查外部数据时我会调用工具。
      </p>

      <div
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="`message--${message.role}`"
      >
        <template v-for="(part, index) in message.parts" :key="index">
          <p v-if="part.type === 'text' && part.text" class="message__text">{{ part.text }}</p>

          <p
            v-else-if="part.type === 'action'"
            class="message__action"
            :class="{ 'message__action--failed': part.result && !part.result.ok }"
          >
            <code>{{ describeAction(part.action) }}</code>
            <span v-if="part.result" class="message__action-result">
              {{ part.result.ok ? '✓' : '✕' }} {{ part.result.message }}
            </span>
          </p>

          <p
            v-else-if="part.type === 'tool-call'"
            class="message__action message__tool"
            :class="{ 'message__action--failed': part.result && !part.result.ok }"
          >
            <code>{{ describeToolCall(part.call) }}</code>
            <span v-if="part.result" class="message__action-result">
              {{ part.result.ok ? '✓' : '✕' }} {{ describeToolResult(part.result) }}
            </span>
          </p>

          <details v-else-if="part.type === 'raw' && part.text" class="message__raw">
            <summary>模型原始输出{{ part.label ? `（${part.label}）` : '' }}</summary>
            <pre>{{ part.text }}</pre>
          </details>
        </template>
      </div>

      <p v-if="client.runtime.error.value" class="thread__error">{{ client.runtime.error.value }}</p>
    </div>

    <div v-if="suggestions.length" class="thread__suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.prompt"
        type="button"
      >
        <b>{{ suggestion.title }}</b>
        <span v-if="suggestion.label">{{ suggestion.label }}</span>
      </button>
    </div>

    <div class="composer">
      <textarea
        v-model="draft"
        rows="2"
        placeholder="例如：服役期1940.4.28-1948.5.12，添加两个分类：船体（图片）、下水仪式（视频）"
      />
      <button type="button" :disabled="isRunning || !draft.trim()" @click="submit">发送</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Agent } from './Agent'

// const client = useAui()
// const messages = useAuiState((state) => state.thread.messages)
// const isRunning = useAuiState((state) => state.thread.isRunning)
// const suggestions = useAuiState((state) => state.suggestions.suggestions)
const agent = new Agent()

const client = ref({ runtime: { error: {} } })
const suggestions = ref([])
const messages = computed(() => agent.runtime.messages.value)
const isRunning = ref(false)

const draft = ref('')
const viewport = ref<HTMLElement | null>(null)

// watch(
//   messages,
//   () => {
//     nextTick(() => {
//       const el = viewport.value
//       if (el)
//         el.scrollTop = el.scrollHeight
//     })
//   },
//   { deep: true },
// )

function submit() {
  const text = draft.value.trim()

  agent.runtime.run(text)
  draft.value = ''
}

// function useSuggestion(prompt: string) {
//   draft.value = prompt
//   submit()
// }

// function onKeydown(event: KeyboardEvent) {
//   if (event.key === 'Enter' && !event.shiftKey) {
//     event.preventDefault()
//     submit()
//   }
// }
</script>

<style lang="scss" scoped>
.thread {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 520px;
  box-sizing: border-box;
  padding: 18px 20px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
}

.thread__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.thread__header h3 {
  margin: 0;
  font-size: 15px;
}

.thread__status {
  margin-left: auto;
  font-size: 12px;
  color: #9ca3af;
}

.thread__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.thread__dot--busy {
  background: #f59e0b;
}

.thread__viewport {
  flex: 1;
  overflow-y: auto;
  padding: 14px 2px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.thread__empty {
  margin: auto 0;
  color: #9ca3af;
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}

.thread__error {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 12.5px;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 90%;
}

.message--user {
  align-self: flex-end;
  align-items: flex-end;
}

.message--assistant {
  align-self: flex-start;
  align-items: flex-start;
}

.message__text {
  margin: 0;
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f3f4f6;
  color: #1f2937;
}

.message--user .message__text {
  background: #4f46e5;
  color: #fff;
}

/* Action 及其执行结果：set(activeTime, [...]) + Form Engine 的反馈 */
.message__action {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 7px 10px;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: #f8faff;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.message__action code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  color: #2563eb;
}

.message__action-result {
  color: #059669;
}

.message__action--failed {
  border-color: #fecaca;
  background: #fef2f2;
}

.message__action--failed .message__action-result {
  color: #b91c1c;
}

/* Tool Call：和 Action 区分开，蓝色 > Action，紫色 > Tool */
.message__tool code {
  color: #7c3aed;
}

.message__tool {
  border-color: #ede9fe;
  background: #fbfaff;
}

/* 模型原始输出：对着 Prompt / response_format 排查用 */
.message__raw {
  font-size: 12px;
  color: #6b7280;
}

.message__raw summary {
  cursor: pointer;
}

.message__raw pre {
  margin: 6px 0 0;
  padding: 10px;
  border-radius: 10px;
  background: #111827;
  color: #d1fae5;
  font-size: 11.5px;
  line-height: 1.6;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.thread__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 0;
  border-top: 1px solid #f3f4f6;
}

.thread__suggestions button {
  border: 1px solid #e5e7eb;
  background: #fafafa;
  color: #4b5563;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}

.thread__suggestions button:hover {
  border-color: #c7d2fe;
  color: #4338ca;
}

.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.composer textarea {
  flex: 1;
  resize: none;
  padding: 9px 11px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font: inherit;
  font-size: 13.5px;
  outline: none;
}

.composer textarea:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.composer button {
  padding: 9px 16px;
  border: none;
  border-radius: 10px;
  background: #4f46e5;
  color: #fff;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.composer button:disabled {
  background: #c7d2fe;
  cursor: not-allowed;
}
</style>
