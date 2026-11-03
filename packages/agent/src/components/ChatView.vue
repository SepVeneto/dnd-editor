<template>
  <main
    class="chat-view"
    :class="[{ embedded }]"
  >
    <header class="chat-header">
      <div class="chat-meta">
        <span class="live-badge">
          <span
            class="live-dot"
            aria-hidden="true"
          />
          {{ runtimeConfig.model }} · Agent runtime
        </span>
        <span
          class="meta-divider"
          aria-hidden="true"
        />
        <span>Session {{ sessionId.slice(0, 8) }}</span>
      </div>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>

    <section
      class="chat-panel"
      :aria-busy="isStreaming"
    >
      <div
        ref="messageList"
        class="message-list"
        role="log"
        aria-live="polite"
      >
        <div
          v-if="messages.length === 0"
          class="empty-state"
        >
          <div
            class="empty-orbit"
            aria-hidden="true"
          >
            <span class="orbit-ring" />
            <svg viewBox="0 0 24 24">
              <path d="M12 3a6 6 0 0 0-3.6 10.8V17h7.2v-3.2A6 6 0 0 0 12 3Z" />
              <path d="M9 20h6M12 17v-5" />
            </svg>
          </div>
          <h2>开始对话</h2>
          <p>
            发送消息后，Agents SDK 会在浏览器中运行，并实时展示思考、工具调用和文本结果。
          </p>
          <div
            class="example-list"
            aria-label="示例问题"
          >
            <button
              v-for="example in examples"
              :key="example"
              type="button"
              class="example-prompt"
              @click="useExample(example)"
            >
              {{ example }}
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>

        <div
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="[message.role]"
        >
          <div
            v-if="message.role === 'assistant'"
            class="avatar assistant-avatar"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2.8 13.8 9l6.2 1.8-6.2 1.8L12 19l-1.8-6.4L4 10.8 10.2 9 12 2.8Z" />
            </svg>
          </div>
          <div class="message-content">
            <div class="message-label">
              <span>{{ message.role === 'assistant' ? '助手' : '你' }}</span>
              <span
                v-if="
                  isStreaming
                    && message.id === messages[messages.length - 1]?.id
                "
                class="streaming-label"
              >
                正在生成
              </span>
            </div>
            <div class="message-bubble">
              <MessagePart
                v-for="(part, index) in message.parts"
                :key="`${message.id}-${part.type}-${index}`"
                :part="part"
              />
              <span
                v-if="message.parts.length === 0 && isStreaming"
                class="thinking"
                aria-label="助手正在思考"
              >
                <i /><i /><i />
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="error"
          class="error-banner"
          role="alert"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
            />
            <path d="M12 7.5v5M12 16.5h.01" />
          </svg>
          <span>{{ error }}</span>
        </div>
      </div>

      <footer class="composer-area">
        <form
          class="composer"
          @submit.prevent="sendMessage"
        >
          <label
            class="sr-only"
            for="dnd-agent-message"
          >消息</label>
          <textarea
            id="dnd-agent-message"
            v-model="draft"
            :placeholder="placeholder"
            rows="1"
            :disabled="isStreaming"
            @keydown="handleComposerKeydown"
          />
          <button
            v-if="isStreaming"
            type="button"
            class="send-button stop"
            aria-label="停止生成"
            @click="stopStreaming"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <rect
                x="7"
                y="7"
                width="10"
                height="10"
                rx="1.5"
              />
            </svg>
          </button>
          <button
            v-else
            type="submit"
            class="send-button"
            :disabled="!draft.trim()"
            aria-label="发送消息"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="m5 12 14-7-4.5 14-2.8-5.2L5 12Z" />
              <path d="m11.7 13.8 3-3" />
            </svg>
          </button>
        </form>
        <div class="composer-hint">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <span>思考 + 工具调用</span>
        </div>
      </footer>
    </section>

    <p
      v-if="!embedded"
      class="demo-note"
    >
      Agent runtime: {{ runtimeConfig.model }} · {{ runtimeConfig.apiMode }}。
      业务凭据由宿主代理，不进入浏览器。
    </p>
  </main>
</template>

<script setup lang="ts">
import type { AgentRuntime } from '../runtime'
import type { ChatMessage, ChatMode } from '../types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import MessagePart from './MessagePart.vue'

const props = withDefaults(
  defineProps<{
    mode: ChatMode
    title: string
    description: string
    placeholder: string
    examples: string[]
    sessionId: string
    runtime: AgentRuntime
    storageNamespace?: string
    embedded?: boolean
  }>(),
  {
    storageNamespace: 'dnd-agent',
    embedded: false,
  },
)

const emit = defineEmits<{
  running: [value: boolean]
}>()

const runtimeConfig = computed(() => props.runtime.config)

function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(
      `${props.storageNamespace}:${props.mode}:${props.sessionId}`,
    )
    if (!stored)
      return []

    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed as ChatMessage[] : []
  }
  catch {
    return []
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    localStorage.setItem(
      `${props.storageNamespace}:${props.mode}:${props.sessionId}`,
      JSON.stringify(messages),
    )
  }
  catch {
    // The chat remains usable when storage is unavailable.
  }
}

const messages = ref<ChatMessage[]>(loadMessages())
const draft = ref('')
const isStreaming = ref(false)
const error = ref('')
const messageList = ref<HTMLElement>()
let activeRun = 0
let scrollFrame = 0
let activeController: AbortController | undefined

watch(
  messages,
  value => saveMessages(value),
  { deep: true },
)

watch(isStreaming, value => emit('running', value))

function scrollToLatest() {
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    if (messageList.value)
      messageList.value.scrollTop = messageList.value.scrollHeight
  })
}

function stopStreaming() {
  activeController?.abort()
  activeRun += 1
  isStreaming.value = false
}

function useExample(example: string) {
  if (!isStreaming.value)
    draft.value = example
}

async function sendMessage() {
  const prompt = draft.value.trim()
  if (!prompt || isStreaming.value)
    return

  const run = ++activeRun
  const controller = new AbortController()
  activeController = controller
  error.value = ''
  isStreaming.value = true
  draft.value = ''
  const history = messages.value.slice()

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: prompt }],
  })

  const assistantMessage: ChatMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    parts: [],
  }
  messages.value.push(assistantMessage)
  const activeAssistantMessage = messages.value[messages.value.length - 1]
    ?? assistantMessage
  scrollToLatest()

  try {
    await props.runtime.runTurn({
      runtimeSessionId: `${props.mode}:${props.sessionId}`,
      prompt,
      mode: props.mode,
      message: activeAssistantMessage,
      history,
      signal: controller.signal,
      onUpdate: scrollToLatest,
    })
  }
  catch (streamError) {
    if (run === activeRun && !controller.signal.aborted) {
      if (
        streamError instanceof TypeError
        && /fetch|network/i.test(streamError.message)
      ) {
        error.value = `无法连接 ${runtimeConfig.value.baseURL}，请确认代理服务已启动且允许当前站点跨域访问。`
      }
      else {
        error.value = streamError instanceof Error
          ? streamError.message
          : 'Agent 运行时请求失败。'
      }
    }
  }
  finally {
    if (run === activeRun) {
      isStreaming.value = false
      activeController = undefined
      scrollToLatest()
    }
  }
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
  }
}

onBeforeUnmount(() => {
  activeController?.abort()
  activeRun += 1
  cancelAnimationFrame(scrollFrame)
})
</script>
