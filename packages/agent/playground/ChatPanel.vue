<template>
  <section class="chat">
    <header class="chat__header">
      <span class="chat__dot" :class="{ 'chat__dot--busy': isRunning }" />
      <h2>装修助手</h2>
      <span class="chat__status">{{ isRunning ? '正在生成…' : '在线' }}</span>
    </header>

    <div ref="viewport" class="chat__viewport">
      <p v-if="!messages.length" class="chat__empty">
        这里直接驱动 <code>Agent</code> 的 runtime。发一句话试试，
        <br />
        例如：把卖卡券的那块移到商品列表前面。
      </p>

      <article
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="`message--${message.role}`"
      >
        <template v-for="(part, index) in message.parts" :key="index">
          <p v-if="part.type === 'text'" class="message__text">{{ part.text }}</p>

          <p
            v-else-if="part.type === 'action'"
            class="part part--action"
            :class="{ 'part--failed': failed(part.result) }"
          >
            <code>{{ describeAction(part.action) }}</code>
            <span v-if="part.result" class="part__result">{{ describeResult(part.result) }}</span>
          </p>

          <p
            v-else-if="part.type === 'tool-call'"
            class="part part--tool"
            :class="{ 'part--failed': failed(part.result) }"
          >
            <code>{{ describeToolCall(part.call) }}</code>
            <span v-if="part.result" class="part__result">{{ describeResult(part.result) }}</span>
          </p>

          <details v-else-if="part.type === 'raw'" class="part part--raw">
            <summary>模型原始输出{{ part.label ? `（${part.label}）` : '' }}</summary>
            <pre>{{ part.text }}</pre>
          </details>
        </template>

        <span v-if="isStreamingId === message.id" class="message__caret" />
      </article>
    </div>

    <div class="chat__suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion"
        type="button"
        :disabled="isRunning"
        @click="useSuggestion(suggestion)"
      >
        {{ suggestion }}
      </button>
    </div>

    <form class="composer" @submit.prevent="submit">
      <textarea
        v-model="draft"
        rows="2"
        placeholder="用一句话描述你要做的编辑…（Enter 发送，Shift+Enter 换行）"
        :disabled="isRunning"
        @keydown.enter.exact.prevent="submit"
      />
      <div class="composer__actions">
        <button v-if="isRunning" type="button" class="composer__stop" @click="stop">
          停止
        </button>
        <button type="submit" class="composer__send" :disabled="isRunning || !draft.trim()">
          发送
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import type { MessagePart, ThreadMessage } from '@/agent/type'
import type { Agent } from '@/agent/Agent'
import type { ModelConfig, RespondEvent, Responder } from './responders'
import { computed, nextTick, ref, triggerRef, watch } from 'vue'

const props = defineProps<{
  agent: Agent
  responder: Responder
  config: ModelConfig
}>()

const suggestions = [
  '把卖卡券的那块移到商品列表前面',
  '首页展示 A 卡券和 B 场景两个入口',
  '查一下这个店铺的卡券数据',
]

const draft = ref('')
const viewport = ref<HTMLElement | null>(null)
const streamingId = ref<string | null>(null)

let controller: AbortController | null = null

const messages = computed(() => props.agent.runtime.messages.value)
const isRunning = computed(() => props.agent.runtime.isRunning.value)
const isStreamingId = computed(() => streamingId.value)

watch(messages, scrollToBottom, { deep: true, flush: 'post' })

function scrollToBottom() {
  nextTick(() => {
    const el = viewport.value
    if (el)
      el.scrollTop = el.scrollHeight
  })
}

function useSuggestion(text: string) {
  draft.value = text
  submit()
}

function stop() {
  controller?.abort()
  streamingId.value = null
}

async function submit() {
  const text = draft.value.trim()
  if (!text || isRunning.value)
    return

  const { messages: ref_ } = props.agent.runtime
  const history: ThreadMessage[] = ref_.value.map(toPlainMessage)

  props.agent.runtime.run(text)
  draft.value = ''

  const reply: ThreadMessage = {
    id: createId(),
    role: 'copilot',
    parts: [],
  }
  ref_.value.push(reply)
  triggerRef(ref_)

  controller = new AbortController()
  streamingId.value = reply.id

  let textPart: Extract<MessagePart, { type: 'text' }> | null = null

  try {
    for await (const event of props.responder(text, {
      signal: controller.signal,
      config: props.config,
      history,
    })) {
      applyEvent(reply, event, () => textPart, (part) => { textPart = part })
    }
  }
  catch (error) {
    if (!isAbortError(error))
      reply.parts.push({ type: 'text', text: `⚠️ ${toMessage(error)}` })
  }
  finally {
    streamingId.value = null
    controller = null
    props.agent.runtime.isRunning.value = false
    triggerRef(ref_)
  }
}

function applyEvent(
  reply: ThreadMessage,
  event: RespondEvent,
  getTextPart: () => Extract<MessagePart, { type: 'text' }> | null,
  setTextPart: (part: Extract<MessagePart, { type: 'text' }> | null) => void,
) {
  if (event.type === 'text-delta') {
    let part = getTextPart()
    if (!part) {
      part = { type: 'text', text: '' }
      reply.parts.push(part)
      setTextPart(part)
    }
    part.text += event.text
  }
  else {
    setTextPart(null)
    reply.parts.push(event.part)
  }

  triggerRef(props.agent.runtime.messages)
}

function toPlainMessage(message: ThreadMessage): ThreadMessage {
  return JSON.parse(JSON.stringify(message))
}

function failed(result: unknown): boolean {
  return !!result && typeof result === 'object' && (result as { ok?: boolean }).ok === false
}

function describeResult(result: unknown): string {
  const value = result as { ok?: boolean, message?: string } | undefined
  const mark = value?.ok === false ? '✕' : '✓'
  return `${mark} ${value?.message ?? JSON.stringify(result)}`
}

function describeAction(action: unknown): string {
  const value = action as { capability?: string, args?: unknown } | undefined
  if (value?.capability)
    return `${value.capability}(${stringifyArgs(value.args)})`

  return JSON.stringify(action)
}

function describeToolCall(call: unknown): string {
  const value = call as { name?: string, args?: unknown } | undefined
  if (value?.name)
    return `tool:${value.name}(${stringifyArgs(value.args)})`

  return JSON.stringify(call)
}

function stringifyArgs(args: unknown): string {
  if (args === undefined)
    return ''

  const text = typeof args === 'string' ? args : JSON.stringify(args)
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { name?: string }).name === 'AbortError'
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function createId(): string {
  return Math.random().toString(36).slice(2, 10)
}
</script>

<style scoped>
.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
}

.chat__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line-soft);
}

.chat__header h2 {
  margin: 0;
  font-size: 15px;
}

.chat__status {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}

.chat__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.chat__dot--busy {
  background: #f59e0b;
}

.chat__viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat__empty {
  margin: auto 0;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.9;
  text-align: center;
}

.chat__empty code {
  padding: 1px 5px;
  border-radius: 5px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
}

.message {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 92%;
}

.message--user {
  align-self: flex-end;
  align-items: flex-end;
}

.message--copilot {
  align-self: flex-start;
  align-items: flex-start;
}

.message__text {
  margin: 0;
  padding: 9px 12px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: #f3f4f6;
  color: #1f2937;
}

.message--user .message__text {
  background: #4f46e5;
  color: #fff;
}

.message__caret {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a5b4fc;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  50% { opacity: 0.25; }
}

.part {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 7px 10px;
  border-radius: 10px;
  border: 1px solid #dbeafe;
  background: #f8faff;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.part code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  color: #2563eb;
}

.part__result {
  color: #059669;
}

.part--tool code {
  color: #7c3aed;
}

.part--tool {
  border-color: #ede9fe;
  background: #fbfaff;
}

.part--failed {
  border-color: #fecaca;
  background: #fef2f2;
}

.part--failed .part__result {
  color: #b91c1c;
}

.part--raw {
  font-size: 12px;
  color: var(--text-muted);
}

.part--raw summary {
  cursor: pointer;
}

.part--raw pre {
  margin: 6px 0 0;
  padding: 10px;
  max-height: 220px;
  border-radius: 10px;
  background: #0f172a;
  color: #a7f3d0;
  font-size: 11.5px;
  line-height: 1.6;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chat__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 18px;
  border-top: 1px solid var(--line-soft);
}

.chat__suggestions button {
  border: 1px solid var(--line);
  background: #fafafa;
  color: #4b5563;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.chat__suggestions button:hover:not(:disabled) {
  border-color: #c7d2fe;
  color: #4338ca;
}

.chat__suggestions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--line-soft);
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

.composer__actions {
  display: flex;
  gap: 6px;
}

.composer__actions button {
  padding: 9px 16px;
  border: none;
  border-radius: 10px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}

.composer__send {
  background: #4f46e5;
  color: #fff;
}

.composer__send:disabled {
  background: #c7d2fe;
  cursor: not-allowed;
}

.composer__stop {
  background: #fef2f2;
  color: #b91c1c;
}
</style>
