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
      <p class="approval__text">{{ describeApproval(pendingApproval) }}</p>
      <div class="approval__actions">
        <button type="button" class="approval__reject" @click="resolveApproval(false)">
          不同意
        </button>
        <button type="button" class="approval__approve" @click="resolveApproval(true)">
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
import { nextTick, reactive, ref, watch } from 'vue'
import OpenAI from 'openai'
import { Agent } from './Agent'
import type { ToolApprovalRequest } from './Agent'
import { run } from './core/run'
import type { RunEvent } from './core/run'
import type { MessagePart } from './type'
import { z } from 'zod'
import { tool } from './core/tool'

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

const client = new OpenAI({
  baseURL: 'http://localhost:4000/v1',
  apiKey: 'test',
  dangerouslyAllowBrowser: true,
})

const checkScenesTool = tool({
  name: 'check_scenes_enabled',
  description: `
查询业务系统中指定场景的开通状态。

输入场景名称列表，调用业务接口查询这些场景是否已经开通。
只负责查询，不修改配置，不进行业务判断。
返回每个场景对应的开通状态以及业务系统返回的信息。
  `,
  parameters: z.object({
    scenes: z.array(z.object({ name: z.string() })),
  }),
  // mock 查询接口：只负责返回各场景的开通状态
  invoke: async (input: { scenes: Array<{ name: string }> }) => {
    const res = await fetch('http://localhost:4000/v1/business/scenes')
    const resJson = await res.json()
    const scenes: SceneState[] = input.scenes.map(item => {
      const target = resJson.data.find((each: any) => each.name === item.name)
      if (!target) {
        throw new Error('cannot find scene ' + item.name)
      }
      return {
        id: target.id,
        name: target.name,
        enabled: !!target.status,
        message: target.status
          ? '业务系统返回：场景已开通'
          : '业务系统返回：场景未开通',
      }
    })

    const disabled = scenes.filter(scene => !scene.enabled).map(scene => scene.name)
    return {
      scenes,
      message: disabled.length
        ? `以下场景未开通：${disabled.join('、')}。需要自行开通。`
        : '所有场景均已开通。',
    }
  },
})

// 开通属于写操作：调用本工具后运行时会自动暂停并请用户确认，
// 所以模型应当直接调用，而不是在文本里询问用户。
const enableSceneTool = tool({
  name: 'enable_scene',
  description: `
开通业务系统中指定的场景。
  `,
  parameters: z.object({
    id: z.number(),
    name: z.string(),
  }),
  needsApproval: true,
  // mock 开通逻辑
  invoke: async (input: { id: number, name: string }) => {
    const res = await fetch('http://localhost:4000/v1/business/scene', { method: 'post' })
    const resJson = await res.json()
    if (resJson.code !== 0) {
      throw new Error(resJson.message ?? `场景 ${input.name} 开通失败`)
    }
    return {
      id: input.id,
      name: input.name,
      enabled: true,
      message: `业务系统返回：场景 ${input.name} 已开通`,
    }
  },
})

const docsAgent = new Agent({
  name: 'parse desc',
  instructions: `
你是一个业务配置文档解析器。

你的任务是将用户提供的自然语言、表格、Word 文档文本或混合格式内容，
解析成结构化业务配置。

规则：

1. 只解析用户提供的信息。
2. 不调用任何工具。
3. 不补充用户没有提供的信息。
4. 不删除重复记录。
5. 不合并重复行。
6. 用户没有提供的字段使用 null。
7. 保留用户输入中的原始名称、数值和描述。
8. 表格每一行都必须独立解析。
9. 手续费保持原始百分比形式，例如 "2%"。
10. 面值是数字时输出 number。
11. 不进行业务查询。
12. 不判断配置是否正确。
13. 不进行名称匹配。

需要解析三类配置：

H5外接场景：
- name
- fee

品牌商户：
- name
- coupon
- faceValue
- fee

扫码提货：
- name
- scope

最终只输出结构化数据。
  `,
  outputType: businessConfigSchema,
})

const verifyAgent = new Agent({
  name: 'verify configuration',
  instructions: `
你是业务配置校验器。

你的输入是 Parser Agent 解析得到的结构化业务配置。

你的任务是：

1. 根据输入中的场景信息，调用 check_scenes_enabled 工具。
2. 将用户提供的场景名称传给工具。
3. 根据工具返回的真实业务数据判断每个场景是否已开通。
4. 不修改用户提供的原始配置。
5. 不自行假设业务系统中不存在的数据。
6. 如果工具返回的信息不足以判断，则明确说明无法判断。
7. 对每个「未开通」的场景，直接调用 enable_scene 发起开通，一次可以请求多个。
   用户确认由工具自动触发，禁止在回复文本里询问「是否要开通」，直接调用工具即可。
8. 如果某个场景用户不同意开通，不要重试，继续处理下一个未开通的场景。
9. 最终汇总所有场景的检查结果。

必须调用 check_scenes_enabled 工具获取真实业务数据，
不能仅根据用户输入直接判断场景是否开通。
  `,
  outputType: z.object({
    scenes: z.array(z.object({
      id: z.number().nullable(),
      name: z.string(),
      status: z.string(),
    }))
  }),
  tools: [checkScenesTool, enableSceneTool],
})

let streamText = ''

// —— 工具审批：运行时暂停，等对话框底部的「同意 / 不同意」——
const pendingApproval = ref<ToolApprovalRequest | null>(null)
let approvalResolver: ((approved: boolean) => void) | null = null

function requestApproval(request: ToolApprovalRequest): Promise<boolean> {
  pendingApproval.value = request
  return new Promise<boolean>((resolve) => {
    approvalResolver = resolve
  })
}

function resolveApproval(approved: boolean) {
  const resolve = approvalResolver
  approvalResolver = null
  pendingApproval.value = null
  resolve?.(approved)
}

function describeApproval(request: { name: string, args?: unknown }): string {
  const args = request.args as { name?: string } | undefined
  if (request.name === 'enable_scene' && args?.name)
    return `场景「${args.name}」未开通，是否需要开通？`

  return `是否执行工具 ${request.name}？`
}

async function send(message: string) {
  messages.value.push({
    id: createId(),
    role: 'user',
    parts: [
      { type: 'text', text: message }
    ]
  })

  const config = '{"scenes":[{"name":"叮咚买菜","fee":"2%"},{"name":"大润发小时达","fee":"2%"}],"brand":[{"name":"盒马鲜生","coupon":"米面粮油提货券","faceValue":500,"fee":"2%"},{"name":"盒马鲜生","coupon":"米面粮油提货券","faceValue":200,"fee":"2%"}],"shopPickup":[{"name":"扫码提货","scope":["蛋糕品牌","百果园"]}]}'

  // 每一步都作为 message part 实时展示
  const reply = reactive<{ id: string, role: 'copilot', parts: MessagePart[] }>({
    id: createId(),
    role: 'copilot',
    parts: [],
  })
  messages.value.push(reply)

  let textPart: Extract<MessagePart, { type: 'text' }> | null = null

  function onEvent(event: RunEvent) {
    switch (event.type) {
      case 'turn-start':
        textPart = null
        reply.parts.push({ type: 'step', label: `第 ${event.turn} 轮 · 模型` })
        break

      case 'assistant-text':
        if (!textPart) {
          textPart = { type: 'text', text: '' }
          reply.parts.push(textPart)
        }
        textPart.text += event.text
        break

      case 'tool-call':
        textPart = null
        reply.parts.push({
          type: 'tool-call',
          call: { callId: event.callId, name: event.name, args: event.args },
        })
        break

      case 'approval-request':
        textPart = null
        reply.parts.push({
          type: 'approval',
          call: { callId: event.callId, name: event.name, args: event.args },
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
        const part = reply.parts.find(
          item => item.type === 'tool-call' && (item.call as any)?.callId === event.callId,
        )
        if (part && part.type === 'tool-call')
          part.result = describeCallOutput(event)
        break
      }
    }
  }

  isRunning.value = true
  try {
    // 模型调 check 拿到状态后会对未开通场景调用 enable_scene，
    // 该工具声明了 needsApproval，runtime 会逐个暂停等用户确认。
    await run(verifyAgent, config, { onApproval: requestApproval, onEvent })
  }
  catch (error) {
    reply.parts.push({ type: 'text', text: `⚠️ ${toMessage(error)}` })
  }
  finally {
    isRunning.value = false
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

function describeToolCall(call: unknown): string {
  const value = call as { name?: string, args?: unknown } | undefined
  if (value?.name)
    return `tool:${value.name}(${stringifyArgs(value.args)})`

  return JSON.stringify(call)
}

function describeToolResult(result: unknown): string {
  const value = result as { ok?: boolean, message?: string } | undefined
  return value?.message ?? JSON.stringify(result)
}

function describeCallOutput(call: { name?: string, result?: unknown, error?: string }): { ok: boolean, message: string } {
  if (call.error)
    return { ok: false, message: call.error }

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
