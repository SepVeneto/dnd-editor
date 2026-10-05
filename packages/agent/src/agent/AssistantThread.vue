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
          <div v-if="part.type === 'step'" class="message__step">{{ part.label }}</div>

          <p v-else-if="part.type === 'text' && part.text" class="message__text">{{ part.text }}</p>

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

          <div
            v-else-if="part.type === 'tool-call'"
            class="flow"
            :class="{ 'flow--failed': part.result && !toolOk(part.result) }"
          >
            <div class="flow__head">
              <span class="flow__badge">工具</span>
              <code class="flow__name">{{ toolName(part.call) }}</code>
              <span v-if="!part.result" class="flow__status flow__status--pending">执行中…</span>
              <span v-else class="flow__status">{{ toolOk(part.result) ? '✓ 完成' : '✕ 失败' }}</span>
            </div>
            <div class="flow__row">
              <span class="flow__label">输入</span>
              <pre class="flow__code">{{ formatPayload(toolArgs(part.call)) }}</pre>
            </div>
            <div class="flow__row">
              <span class="flow__label">输出</span>
              <pre class="flow__code">{{ part.result ? formatPayload(toolOutput(part.result)) : '等待输出…' }}</pre>
            </div>
          </div>

          <p
            v-else-if="part.type === 'approval'"
            class="message__action message__approval"
            :class="{ 'message__action--failed': part.decision === 'rejected' }"
          >
            <code>{{ describeApproval(part.call) }}</code>
            <span v-if="part.decision" class="message__action-result">
              {{ part.decision === 'approved' ? '✓ 已同意' : '✕ 已拒绝' }}
            </span>
            <span v-else class="message__action-result message__action-result--pending">等待确认…</span>
          </p>

          <details v-else-if="part.type === 'raw' && part.text" class="message__raw">
            <summary>模型原始输出{{ part.label ? `（${part.label}）` : '' }}</summary>
            <pre>{{ part.text }}</pre>
          </details>
        </template>
      </div>

      <!-- <p v-if="client.runtime.error.value" class="thread__error">{{ client.runtime.error.value }}</p> -->
    </div>

    <div v-if="suggestions.length" class="thread__suggestions">
      <button
        v-for="suggestion in suggestions"
        :key="suggestion.prompt"
        type="button"
        @click="useSuggestion(suggestion.prompt)"
      >
        <b>{{ suggestion.title }}</b>
        <span v-if="suggestion.label">{{ suggestion.label }}</span>
      </button>
    </div>

    <div v-if="pendingApproval" class="approval">
      <p class="approval__text">{{ approvalMessage }}</p>
      <div class="approval__actions">
        <button type="button" class="approval__reject" @click="flowAgent.approval.reject()">
          不同意
        </button>
        <button type="button" class="approval__approve" @click="flowAgent.approval.approve()">
          同意开通
        </button>
      </div>
    </div>

    <div class="composer">
      <textarea
        v-model="draft"
        rows="2"
        placeholder="例如：服役期1940.4.28-1948.5.12，添加两个分类：船体（图片）、下水仪式（视频）"
        @keydown="onKeydown"
      />
      <button type="button" :disabled="isRunning || !draft.trim()" @click="submit">发送</button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, shallowRef, watch } from 'vue'
import OpenAI from 'openai'
import { createDecorationFlowAgent } from './flow'
import { run } from './core/run'
import type { RunEvent } from './core/run'
import type { MessagePart } from './type'
import { z } from 'zod'
import { tool } from './core/tool'

const props = defineProps<{ widgets?: any[] }>()

// 将外部传入的 widgets（可能是分组、Widget 实例或原始 IWidget）拍平，
// 转换成 layoutAgent 需要的 { typeId, description, layout } 列表。
function toLayoutWidgets(widgets: any[] = []): Array<{ typeId: string, description: string, layout: Record<string, any> }> {
  const result: Array<{ typeId: string, description: string, layout: Record<string, any> }> = []
  const visit = (item: any) => {
    if (!item)
      return
    if (Array.isArray(item.list)) {
      item.list.forEach(visit)
      return
    }
    const data = item._data ?? item
    const typeId = item.view ?? data._view
    const agent = data.agent
    if (!typeId || !agent)
      return
    result.push({
      typeId,
      description: agent.description ?? '',
      layout: agent.layout ?? {},
    })
  }
  widgets.forEach(visit)
  console.log(result)
  return result
}

const businessConfigSchema = z.object({
  scenes: z.array(
    z.object({
      name: z.string(),
      fee: z.string(),
    })
  ),
  brand: z.array(
    z.object({
      name: z.string(),
      coupon: z.string(),
      faceValue: z.number().nullable(),
      fee: z.string(),
    })
  ),
  shopPickup: z.array(
    z.object({
      name: z.string(),
      scope: z.array(z.string()),
    })
  )
})

type SceneState = {
  id: number
  name: string
  enabled: boolean
  message: string
}

const data = shallowRef<any>({})

const client = new OpenAI({
  baseURL: 'http://localhost:4000/v1',
  apiKey: 'test',
  dangerouslyAllowBrowser: true,
})


let streamText = ''

function describeApproval(request: { name: string, args?: unknown, message?: string }): string {
  return request.message || `是否执行工具 ${request.name}？`
}

const emit = defineEmits(['init'])

// 当前正在渲染的 copilot 消息与文本 part，供运行事件回调写入
let activeReply: { id: string, role: 'copilot', parts: MessagePart[] } | null = null
let activeTextPart: Extract<MessagePart, { type: 'text' }> | null = null
// callId -> 对应的 tool-call part（响应式代理），用于把 tool-result 精确回填
const toolCallParts = new Map<string, Extract<MessagePart, { type: 'tool-call' }>>()

function handleEvent(event: RunEvent) {
  const reply = activeReply
  if (!reply)
    return

  switch (event.type) {
    case 'turn-start':
      activeTextPart = null
      reply.parts.push({ type: 'step', label: `第 ${event.turn} 轮 · 模型` })
      break

    case 'assistant-text':
      if (!activeTextPart) {
        activeTextPart = { type: 'text', text: '' }
        reply.parts.push(activeTextPart)
      }
      activeTextPart.text += event.text
      break

    case 'tool-call':
      activeTextPart = null
      reply.parts.push({
        type: 'tool-call',
        call: { callId: event.callId, name: event.name, args: event.args },
      })
      toolCallParts.set(
        event.callId,
        reply.parts[reply.parts.length - 1] as Extract<MessagePart, { type: 'tool-call' }>,
      )
      break

    case 'approval-request':
      activeTextPart = null
      reply.parts.push({
        type: 'approval',
        call: { callId: event.callId, name: event.name, args: event.args, message: event.message },
      })
      break

    case 'approval-result': {
      const part = reply.parts.find(
        item => item.type === 'approval' && (item.call as any)?.callId === event.callId,
      )
      if (part && part.type === 'approval')
        part.decision = event.approved ? 'approved' : 'rejected'
      break
    }

    case 'tool-result': {
      const part = toolCallParts.get(event.callId)
      if (part) {
        part.result = {
          ...describeCallOutput(event),
          raw: event.error ?? event.result,
        }
      }
      break
    }
  }
}

// 流程 Agent 只在 setup 里构建一次，把子 Agent 暴露成 tool，
// 由模型根据「用户输入」选择调用哪个子 Agent。
const { agent: flowAgent, state: flowState, reset: resetFlow } = createDecorationFlowAgent()

// 审批状态由 Agent 管理，面板只读 agent.approval.pending
const pendingApproval = computed(() => flowAgent.approval.pending.value ?? null)
const approvalMessage = computed(() => flowAgent.approval.message.value)

watch(() => props.widgets, () => {
  if (!props.widgets) return

  flowState.widgets = toLayoutWidgets(props.widgets)
}, { immediate: true})

async function send(message: string) {
  messages.value.push({
    id: createId(),
    role: 'user',
    parts: [
      { type: 'text', text: message }
    ]
  })

  // mock 数据：仅用于本地调试时手动替换用户输入，运行时不再使用
  // const config = '{"scenes":[{"name":"叮咚买菜","fee":"2%"},{"name":"大润发小时达","fee":"2%"}],"brand":[{"name":"盒马鲜生","coupon":"米面粮油提货券","faceValue":500,"fee":"2%"},{"name":"盒马鲜生","coupon":"米面粮油提货券","faceValue":200,"fee":"2%"}],"shopPickup":[{"name":"扫码提货","scope":["蛋糕品牌","百果园"]}]}'
  // const businessElements = {
  //   scenes: [{ id: 1, name: '大润发小时达' }, { id: 2, name: '叮咚买菜' }],
  //   // coupon: [{ id: 1, name: '盒马', faceValue: 500 }],
  // }

  // 每一步都作为 message part 实时展示
  const reply = reactive<{ id: string, role: 'copilot', parts: MessagePart[] }>({
    id: createId(),
    role: 'copilot',
    parts: [],
  })
  messages.value.push(reply)

  activeReply = reply
  activeTextPart = null
  toolCallParts.clear()
  resetFlow()
  // 宿主侧的可用组件注入共享 state，供布局子 Agent 调用时使用
  flowState.widgets = toLayoutWidgets(props.widgets)

  isRunning.value = true
  try {
    // 输入完全来自用户：直接把用户消息交给流程 Agent，
    // 由模型决定调用哪个子 Agent（tool）以及给它什么参数。
    await run(flowAgent, message, { onEvent: handleEvent })
  }
  catch (error) {
    reply.parts.push({ type: 'text', text: `⚠️ ${toMessage(error)}` })
  }
  finally {
    isRunning.value = false
    activeReply = null
    activeTextPart = null
  }

  // TODO: 在这里要对数据做处理，最终抛出去的应该是根据数据索引，组件索引替换过的数据
  if (flowState.layout !== undefined) {
    emit('init', flowState.layout, data.value)
  }
}

const suggestions = ref<Array<{ title: string, label?: string, prompt: string }>>([])
const messages = ref<any[]>([])
const isRunning = ref(false)

const draft = ref('')
const viewport = ref<HTMLElement | null>(null)

watch(
  messages,
  () => {
    nextTick(() => {
      const el = viewport.value
      if (el)
        el.scrollTop = el.scrollHeight
    })
  },
  { deep: true },
)

function createId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function submit() {
  const text = draft.value.trim()
  if (!text || isRunning.value)
    return

  send(text)
  draft.value = ''
}

function useSuggestion(prompt: string) {
  if (isRunning.value)
    return

  draft.value = prompt
  submit()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
}

function describeAction(action: unknown): string {
  const value = action as { capability?: string, args?: unknown } | undefined
  if (value?.capability)
    return `${value.capability}(${stringifyArgs(value.args)})`

  return JSON.stringify(action)
}

function toolName(call: unknown): string {
  return (call as { name?: string } | undefined)?.name ?? ''
}

function toolArgs(call: unknown): unknown {
  return (call as { args?: unknown } | undefined)?.args
}

function toolOk(result: unknown): boolean {
  return !!(result as { ok?: boolean } | undefined)?.ok
}

function toolOutput(result: unknown): unknown {
  const value = result as { raw?: unknown, message?: string } | undefined
  return value?.raw ?? value?.message ?? result
}

function formatPayload(value: unknown): string {
  if (value === undefined || value === null)
    return '—'
  if (typeof value === 'string')
    return value
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function describeCallOutput(call: { name?: string, result?: unknown, error?: string }): { ok: boolean, message: string } {
  if (call.error)
    return { ok: false, message: call.error }

  // 子 Agent 作为 tool 调用时，返回的是它自己的最终文本
  if (typeof call.result === 'string')
    return { ok: true, message: call.result }

  if (call.name === 'check_scenes_enabled') {
    const scenes = (call.result as { scenes?: Array<{ name: string, enabled: boolean }> } | undefined)?.scenes ?? []
    const off = scenes.filter(scene => !scene.enabled).map(scene => scene.name)
    const on = scenes.filter(scene => scene.enabled).map(scene => scene.name)
    return { ok: true, message: `未开通：${off.join('、') || '无'}；已开通：${on.join('、') || '无'}` }
  }

  const value = call.result as { message?: string } | undefined
  return { ok: true, message: value?.message ?? JSON.stringify(call.result) }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function stringifyArgs(args: unknown): string {
  if (args === undefined)
    return ''

  const text = typeof args === 'string' ? args : JSON.stringify(args)
  return text.length > 72 ? `${text.slice(0, 72)}…` : text
}
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

/* 第 N 轮 / 阶段标题 */
.message__step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #94a3b8;
}

.message__step::after {
  content: "";
  flex: 1;
  height: 1px;
  background: #eef2f7;
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

.message__action-result--pending {
  color: #b45309;
}

/* Tool Call：和 Action 区分开，蓝色 > Action，紫色 > Tool */
.message__approval {
  border-color: #fde68a;
  background: #fffbeb;
}

.message__approval code {
  color: #b45309;
}

/* 执行流程：工具调用的名称 / 输入 / 输出 */
.flow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 2px 0;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #e9d5ff;
  background: #faf5ff;
  font-size: 12px;
}

.flow--failed {
  border-color: #fecaca;
  background: #fef2f2;
}

.flow__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.flow__badge {
  padding: 1px 6px;
  border-radius: 6px;
  background: #ede9fe;
  color: #7c3aed;
  font-size: 11px;
  font-weight: 600;
}

.flow__name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
  color: #6d28d9;
}

.flow__status {
  margin-left: auto;
  color: #059669;
}

.flow--failed .flow__status {
  color: #b91c1c;
}

.flow__status--pending {
  color: #b45309;
}

.flow__row {
  display: flex;
  gap: 8px;
}

.flow__label {
  flex-shrink: 0;
  width: 28px;
  color: #9ca3af;
  line-height: 1.6;
}

.flow__code {
  flex: 1;
  margin: 0;
  padding: 6px 8px;
  border-radius: 8px;
  background: #111827;
  color: #d1fae5;
  font-size: 11.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: auto;
  max-height: 220px;
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

.approval {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #fde68a;
  background: #fffbeb;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.approval__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #92400e;
}

.approval__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.approval__actions button {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.approval__reject {
  background: #fff;
  border-color: #fcd34d;
  color: #92400e;
}

.approval__approve {
  background: #f59e0b;
  color: #fff;
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
