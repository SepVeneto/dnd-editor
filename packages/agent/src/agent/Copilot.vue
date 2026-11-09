<template>
  <div
    class="assistant-root"
    :class="{ 'is-resizing': isResizing }"
  >
    <Transition name="assistant-drawer">
      <aside
        v-if="open"
        :id="drawerId"
        ref="drawer"
        class="assistant-drawer"
        role="dialog"
        aria-modal="false"
        :aria-labelledby="drawerTitleId"
        :style="{ '--assistant-drawer-width': `${drawerWidth}px` }"
      >
        <div
          ref="resizeHandle"
          class="resize-handle"
          role="separator"
          tabindex="0"
          aria-orientation="vertical"
          aria-label="调整装修助手宽度"
          :aria-valuemin="MIN_DRAWER_WIDTH"
          :aria-valuemax="maxDrawerWidth"
          :aria-valuenow="drawerWidth"
          title="拖动调整宽度，双击恢复默认宽度"
          @pointerdown.prevent="startDrawerResize"
          @pointermove="resizeDrawer"
          @pointerup="finishDrawerResize"
          @pointercancel="finishDrawerResize"
          @keydown="handleResizeKeydown"
          @dblclick="resetDrawerWidth"
        >
          <span aria-hidden="true" />
        </div>

        <header class="assistant-toolbar">
          <div class="assistant-brand">
            <span
              class="assistant-brand-mark"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 2.8 13.8 9l6.2 1.8-6.2 1.8L12 19l-1.8-6.4L4 10.8 10.2 9 12 2.8Z" />
              </svg>
            </span>
            <span class="assistant-brand-copy">
              <strong :id="drawerTitleId">{{ title }}</strong>
              <small>Agent workspace</small>
            </span>
          </div>

          <div class="assistant-toolbar-actions">
            <button
              type="button"
              class="assistant-new-session"
              aria-label="开启新会话"
              title="开启新会话"
              @click="startNewSession"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>新会话</span>
            </button>
            <span
              class="assistant-status"
              :class="{ running: isRunning }"
            >
              <i aria-hidden="true" />
              {{ isRunning ? '运行中' : '就绪' }}
            </span>
            <button
              ref="closeButton"
              type="button"
              class="assistant-close"
              aria-label="收起装修助手"
              @click="closeDrawer"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        <div class="assistant-drawer-body">
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
        </div>
      </aside>
    </Transition>

    <button
      v-if="!open"
      ref="launcher"
      type="button"
      class="assistant-button"
      :aria-controls="drawerId"
      aria-expanded="false"
      aria-label="打开装修助手"
      @click="openDrawer"
    >
      <span>装修助手</span>
      <span
        class="dot"
        :class="{ ok: isRunning }"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AgentSubAgentDefinition } from '../agents'
import type { AgentHostTool } from '../tool'
import type { AgentHostApi } from '../types'
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue'
import ChatView from '../components/ChatView.vue'
import { createAgentRuntime } from '../runtime'

const props = withDefaults(defineProps<{
  api?: AgentHostApi
  tools?: AgentHostTool[]
  subAgents?: AgentSubAgentDefinition[]
  context?: () => Record<string, unknown>
  sessionId?: string
  storageKey?: string
  title?: string
  description?: string
  placeholder?: string
}>(), {
  api: () => ({}),
  tools: () => [],
  subAgents: () => [],
  sessionId: '',
  storageKey: 'dnd-agent-chat',
  title: '装修助手',
  description: '通过宿主 API 与业务工具完成页面设计。',
  placeholder: '描述你想设计的页面...',
})

const MIN_DRAWER_WIDTH = 360
const DEFAULT_DRAWER_WIDTH = 520
const DRAWER_VIEWPORT_GUTTER = 16

const generatedSessionId = crypto.randomUUID()
const drawerId = `dnd-agent-drawer-${generatedSessionId}`
const drawerTitleId = `dnd-agent-drawer-title-${generatedSessionId}`
const drawerStorageKey = computed(() => `${props.storageKey}:drawer-width`)
const sessionId = ref(props.sessionId.trim() || generatedSessionId)
const model = computed(() => props.api.model?.model || 'qwen3.6-flash')
const runtime = computed(() => createAgentRuntime({
  baseURL: props.api.model?.baseURL,
  model: props.api.model?.model,
  apiMode: props.api.model?.apiMode,
  api: props.api,
  tools: props.tools,
  subAgents: props.subAgents,
  getContext: props.context,
}))

const examples = [
  '帮我设计一个租房产品首页',
  '这个页面如何优化布局？',
  '查询一下当前场景的开通状态',
]

const viewportWidth = ref(
  typeof window === 'undefined' ? 1440 : window.innerWidth,
)
const maxDrawerWidth = computed(() => Math.max(
  MIN_DRAWER_WIDTH,
  viewportWidth.value - DRAWER_VIEWPORT_GUTTER,
))

function clampDrawerWidth(width: number) {
  return Math.round(Math.min(
    Math.max(width, MIN_DRAWER_WIDTH),
    maxDrawerWidth.value,
  ))
}

function readStoredDrawerWidth() {
  try {
    const stored = Number(localStorage.getItem(drawerStorageKey.value))
    if (Number.isFinite(stored) && stored > 0)
      return clampDrawerWidth(stored)
  }
  catch {
    // Use the default width when storage is unavailable.
  }
  return clampDrawerWidth(DEFAULT_DRAWER_WIDTH)
}

const drawerWidth = ref(readStoredDrawerWidth())
const isResizing = ref(false)
const open = ref(false)
const isRunning = ref(false)
const drawer = useTemplateRef<HTMLElement>('drawer')
const resizeHandle = useTemplateRef<HTMLElement>('resizeHandle')
const closeButton = useTemplateRef<HTMLButtonElement>('closeButton')
const launcher = useTemplateRef<HTMLButtonElement>('launcher')
let resizePointerId: number | undefined
let resizeStartX = 0
let resizeStartWidth = 0

function persistDrawerWidth() {
  try {
    localStorage.setItem(drawerStorageKey.value, String(drawerWidth.value))
  }
  catch {
    // The drawer remains resizable when storage is unavailable.
  }
}

function setDrawerWidth(width: number) {
  drawerWidth.value = clampDrawerWidth(width)
}

function startDrawerResize(event: PointerEvent) {
  if (
    event.button !== 0
    || window.matchMedia('(max-width: 560px)').matches
  ) {
    return
  }

  resizePointerId = event.pointerId
  resizeStartX = event.clientX
  resizeStartWidth = drawer.value?.getBoundingClientRect().width
    ?? drawerWidth.value
  isResizing.value = true
  resizeHandle.value?.setPointerCapture(event.pointerId)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function resizeDrawer(event: PointerEvent) {
  if (!isResizing.value || event.pointerId !== resizePointerId)
    return

  setDrawerWidth(resizeStartWidth + resizeStartX - event.clientX)
}

function finishDrawerResize(event?: PointerEvent) {
  if (!isResizing.value)
    return

  if (
    event
    && resizePointerId !== undefined
    && resizeHandle.value?.hasPointerCapture(resizePointerId)
  ) {
    resizeHandle.value.releasePointerCapture(resizePointerId)
  }

  isResizing.value = false
  resizePointerId = undefined
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  persistDrawerWidth()
}

function handleResizeKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 40 : 16

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    setDrawerWidth(drawerWidth.value + step)
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    setDrawerWidth(drawerWidth.value - step)
  }
  else if (event.key === 'Home') {
    event.preventDefault()
    setDrawerWidth(MIN_DRAWER_WIDTH)
  }
  else if (event.key === 'End') {
    event.preventDefault()
    setDrawerWidth(maxDrawerWidth.value)
  }
  else {
    return
  }

  persistDrawerWidth()
}

function resetDrawerWidth() {
  setDrawerWidth(DEFAULT_DRAWER_WIDTH)
  persistDrawerWidth()
}

function openDrawer() {
  open.value = true
}

function startNewSession() {
  isRunning.value = false
  sessionId.value = crypto.randomUUID()
  void nextTick(() => {
    drawer.value
      ?.querySelector<HTMLTextAreaElement>('#dnd-agent-message')
      ?.focus()
  })
}

function closeDrawer() {
  open.value = false
  void nextTick(() => launcher.value?.focus())
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (open.value && event.key === 'Escape')
    closeDrawer()
}

function handleViewportResize() {
  viewportWidth.value = window.innerWidth
  if (window.innerWidth > 560 && !isResizing.value)
    setDrawerWidth(drawerWidth.value)
}

watch(() => props.sessionId, (value) => {
  sessionId.value = value.trim() || generatedSessionId
})

watch(open, async (value) => {
  if (!value)
    return
  await nextTick()
  closeButton.value?.focus()
})

onMounted(() => {
  window.addEventListener('keydown', handleDocumentKeydown)
  window.addEventListener('resize', handleViewportResize)
})

onBeforeUnmount(() => {
  finishDrawerResize()
  window.removeEventListener('keydown', handleDocumentKeydown)
  window.removeEventListener('resize', handleViewportResize)
})
</script>

<style src="../styles/chat.css"></style>

<style scoped>
.assistant-root {
  position: fixed;
  z-index: 2147483000;
  inset: 0;
  pointer-events: none;
}

.assistant-drawer {
  --page-bg: #fff;
  --surface: #fff;
  --surface-raised: #f7f7f5;
  --surface-code: #f4f4f1;
  --border: #d9d9d5;
  --border-soft: #e7e7e3;
  --text: #111;
  --text-muted: #4f4f4b;
  --text-subtle: #73736e;
  --accent: #111;
  --accent-hover: #2c2c29;
  --accent-soft: rgb(17 17 17 / 7%);
  --danger: #b42318;
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  display: flex;
  width: min(
    var(--assistant-drawer-width, 520px),
    calc(100vw - 16px)
  );
  min-width: min(360px, 100vw);
  flex-direction: column;
  border-left: 1px solid #d9d9d5;
  color: #111;
  background: #fff;
  box-shadow: -16px 0 48px rgb(0 0 0 / 12%);
  pointer-events: auto;
  will-change: transform;
}

.assistant-toolbar {
  display: flex;
  min-height: 64px;
  flex: 0 0 64px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px 0 20px;
  border-bottom: 1px solid #ebebe7;
  background: #fff;
}

.assistant-brand {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.assistant-brand-mark {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  color: #fff;
  background: #111;
}

.assistant-brand-mark {
  width: 32px;
  height: 32px;
}

.assistant-brand-mark svg {
  width: 17px;
}

.assistant-brand-copy {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.assistant-brand-copy strong {
  overflow: hidden;
  color: #111;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-brand-copy small {
  color: #85857f;
  font-size: 10.5px;
  letter-spacing: 0.04em;
}

.assistant-toolbar-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.assistant-new-session {
  display: inline-flex;
  height: 32px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid #e1e1dd;
  border-radius: 9px;
  color: #444;
  background: #fff;
  font-size: 11.5px;
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.assistant-new-session:hover {
  border-color: #bdbdb8;
  color: #111;
  background: #f5f5f2;
}

.assistant-new-session svg {
  width: 14px;
}

.assistant-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #777771;
  font-size: 10.5px;
}

.assistant-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a9a9a3;
}

.assistant-status.running i {
  background: #168447;
  box-shadow: 0 0 0 3px rgb(22 132 71 / 10%);
}

.assistant-close {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  border: 1px solid #e1e1dd;
  border-radius: 9px;
  color: #444;
  background: #fff;
  cursor: pointer;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background 160ms ease;
}

.assistant-close:hover {
  border-color: #bdbdb8;
  color: #111;
  background: #f5f5f2;
}

.assistant-close svg {
  width: 16px;
}

.assistant-drawer-body {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 18px;
}

.assistant-drawer-body :deep(.chat-view) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.assistant-drawer-body :deep(.chat-header) {
  display: none;
}

.assistant-drawer-body :deep(.chat-panel) {
  min-height: 0;
  flex: 1;
}

.assistant-drawer-body :deep(.message-list) {
  min-height: 0;
  flex: 1;
}

.assistant-drawer-body :deep(.empty-state) {
  margin-block: auto;
}

.resize-handle {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  left: -6px;
  width: 12px;
  border: 0;
  outline: 0;
  cursor: col-resize;
  touch-action: none;
}

.resize-handle span {
  position: absolute;
  top: 50%;
  left: 4px;
  width: 4px;
  height: 44px;
  border: 1px solid #e5e5e1;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
  transform: translateY(-50%);
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.resize-handle:hover span,
.resize-handle:focus-visible span,
.is-resizing .resize-handle span {
  border-color: #111;
  background: #111;
}

.assistant-button {
  position: absolute;
  right: 10px;
  bottom: 24px;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: #1677ff;
  box-shadow: 0 8px 20px rgb(22 119 255 / 35%);
  cursor: pointer;
  pointer-events: auto;
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

.assistant-drawer-enter-active,
.assistant-drawer-leave-active {
  transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.assistant-drawer-enter-from,
.assistant-drawer-leave-to {
  transform: translateX(100%);
}

@media (max-width: 560px) {
  .assistant-drawer {
    width: 100vw;
    min-width: 0;
    border-left: 0;
    box-shadow: none;
  }

  .assistant-toolbar {
    padding-inline: 14px;
  }

  .assistant-status {
    display: none;
  }

  .assistant-new-session {
    width: 32px;
    padding: 0;
    justify-content: center;
  }

  .assistant-new-session span {
    display: none;
  }

  .assistant-drawer-body {
    padding: 12px;
  }

  .resize-handle {
    display: none;
  }

  .assistant-button {
    right: 8px;
    bottom: 16px;
    padding: 10px 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .assistant-drawer-enter-active,
  .assistant-drawer-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
