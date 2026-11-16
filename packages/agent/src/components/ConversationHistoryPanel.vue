<template>
  <section
    id="dnd-agent-history-panel"
    class="assistant-history-panel"
    aria-label="历史会话"
  >
    <div class="assistant-history-header">
      <div>
        <strong>历史会话</strong>
        <small>选择会话继续对话</small>
      </div>
      <button
        type="button"
        class="assistant-history-close"
        aria-label="关闭历史会话"
        @click="emit('close')"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      </button>
    </div>

    <div class="assistant-history-list">
      <div
        v-if="listLoading"
        class="assistant-history-state"
      >
        正在加载历史会话...
      </div>
      <div
        v-else-if="error"
        class="assistant-history-state is-error"
        role="alert"
      >
        {{ error }}
      </div>
      <div
        v-else-if="conversations.length === 0"
        class="assistant-history-state"
      >
        暂无历史会话
      </div>
      <template v-else>
        <button
          v-for="conversation in conversations"
          :key="conversation.id"
          type="button"
          class="assistant-history-item"
          :class="{ active: conversation.id === activeSessionId }"
          :disabled="conversationLoading"
          @click="emit('select', conversation.id)"
        >
          <span class="assistant-history-item-main">
            <strong>{{ conversation.title }}</strong>
            <time :datetime="conversation.updatedAt">
              {{ formatConversationTime(conversation.updatedAt) }}
            </time>
          </span>
          <span class="assistant-history-preview">
            {{ conversation.preview || '暂无消息预览' }}
          </span>
          <span class="assistant-history-meta">
            {{ conversation.messageCount }} 条消息
          </span>
        </button>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AgentConversationSummary } from '../conversationStorage'

defineProps<{
  conversations: AgentConversationSummary[]
  activeSessionId: string
  listLoading: boolean
  conversationLoading: boolean
  error: string
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
}>()

function formatConversationTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return ''
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<style scoped>
.assistant-history-panel {
  position: absolute;
  z-index: 4;
  top: 64px;
  right: 0;
  bottom: 0;
  display: flex;
  width: min(330px, 100%);
  flex-direction: column;
  border-left: 1px solid #e4e4df;
  background: #fff;
  box-shadow: -12px 0 30px rgb(0 0 0 / 8%);
}

.assistant-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 16px 14px;
  border-bottom: 1px solid #efefeb;
}

.assistant-history-header > div {
  display: grid;
  gap: 2px;
}

.assistant-history-header strong {
  color: #111;
  font-size: 13px;
  font-weight: 650;
}

.assistant-history-header small {
  color: #8b8b85;
  font-size: 10.5px;
}

.assistant-history-close {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  border: 1px solid #e4e4df;
  border-radius: 8px;
  color: #666660;
  background: #fff;
  cursor: pointer;
}

.assistant-history-close:hover {
  border-color: #bdbdb8;
  color: #111;
}

.assistant-history-close svg {
  width: 14px;
}

.assistant-history-list {
  display: flex;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
  scrollbar-color: #c8c8c3 transparent;
  scrollbar-width: thin;
}

.assistant-history-item {
  display: grid;
  width: 100%;
  gap: 5px;
  padding: 11px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #444440;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.assistant-history-item:hover {
  border-color: #e4e4df;
  background: #f7f7f4;
}

.assistant-history-item.active {
  border-color: #d2d2cc;
  background: #f0f0ec;
}

.assistant-history-item:disabled {
  cursor: wait;
  opacity: 0.65;
}

.assistant-history-item-main {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.assistant-history-item-main strong {
  overflow: hidden;
  color: #171715;
  font-size: 12.5px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-history-item-main time {
  flex: 0 0 auto;
  color: #989892;
  font-size: 9.5px;
}

.assistant-history-preview {
  display: -webkit-box;
  overflow: hidden;
  color: #777771;
  font-size: 10.5px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.assistant-history-meta {
  color: #a0a09a;
  font-size: 9.5px;
}

.assistant-history-state {
  margin: auto;
  padding: 24px 16px;
  color: #85857f;
  font-size: 11.5px;
  line-height: 1.5;
  text-align: center;
}

.assistant-history-state.is-error {
  color: #b42318;
}

.assistant-history-enter-active,
.assistant-history-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.assistant-history-enter-from,
.assistant-history-leave-to {
  opacity: 0;
  transform: translateX(18px);
}
</style>
