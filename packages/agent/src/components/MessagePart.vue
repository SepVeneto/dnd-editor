<script setup lang="ts">
import type { MessagePart } from '../types'
import MarkdownContent from './MarkdownContent.vue'

defineProps<{
  part: MessagePart
}>()

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}
</script>

<template>
  <MarkdownContent
    v-if="part.type === 'text'"
    :source="part.text"
  />

  <details
    v-else-if="part.type === 'reasoning'"
    class="part-card reasoning"
  >
    <summary>
      <span
        class="part-icon"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24">
          <path d="M9.5 4.8a6 6 0 1 0 2.5 11.5V20h3v-4.6a6 6 0 0 0-5.5-10.6Z" />
          <path d="M9 9h.01M12 7.5h.01M15 9h.01" />
        </svg>
      </span>
      <span>
        <strong>思考过程</strong>
        <small>助手如何理解和处理当前请求</small>
      </span>
      <svg
        class="chevron"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </summary>
    <div class="part-body">
      <MarkdownContent :source="part.text" />
    </div>
  </details>

  <div
    v-else-if="part.type === 'tool'"
    class="part-card tool"
  >
    <div class="tool-heading">
      <span
        class="part-icon"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24">
          <path d="M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.4 2.4-2.8-.6-.6-2.8 2.8-2Z" />
        </svg>
      </span>
      <div>
        <strong>{{ part.toolName }}</strong>
        <small>工具调用</small>
      </div>
      <span
        :class="[
          'status-pill',
          part.state === 'output-available' ? 'complete' : 'running',
        ]"
      >
        {{ part.state === 'output-available' ? '已完成' : '执行中' }}
      </span>
    </div>

    <div
      v-if="part.input !== undefined"
      class="tool-section"
    >
      <span class="tool-label">输入</span>
      <pre><code>{{ formatJson(part.input) }}</code></pre>
    </div>

    <div
      v-if="part.output !== undefined"
      class="tool-section"
    >
      <span class="tool-label">输出</span>
      <pre><code>{{ formatJson(part.output) }}</code></pre>
    </div>

    <p
      v-if="part.errorText"
      class="tool-error"
    >
      {{ part.errorText }}
    </p>
  </div>

  <div
    v-else-if="part.type === 'data'"
    class="part-card data"
  >
    <div class="tool-heading">
      <span
        class="part-icon"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
      </span>
      <div>
        <strong>{{ part.name }}</strong>
        <small>数据事件</small>
      </div>
    </div>
    <pre><code>{{ formatJson(part.data) }}</code></pre>
  </div>
</template>
