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

      <!-- <p v-if="client.runtime.error.value" class="thread__error">{{ client.runtime.error.value }}</p> -->
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
import OpenAI from 'openai'
import { Agent } from './Agent'
import { run } from './core/run'
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

let previousResponseId: string | undefined

const client = new OpenAI({
  baseURL: 'http://localhost:4000/v1',
  apiKey: 'test',
  dangerouslyAllowBrowser: true,
})

// const client = useAui()
// const messages = useAuiState((state) => state.thread.messages)
// const isRunning = useAuiState((state) => state.thread.isRunning)
// const suggestions = useAuiState((state) => state.suggestions.suggestions)
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
7. 最终汇总所有场景的检查结果。

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
  tools: [
    tool({
      name: 'check_scenes_enabled',
      description: `
查询业务系统中指定场景的开通状态。

输入场景名称列表，调用业务接口查询这些场景是否已经开通。
只负责查询，不修改配置，不进行业务判断。
返回每个场景对应的开通状态以及业务系统返回的信息。
      `,
      parameters:  z.object({
        scenes: z.array(z.object({ name: z.string() }))
      }),
      // 先 mock 业务接口，返回各场景的开通情况
      invoke: async (input: { scenes: Array<{ name: string }> }) => {
        const enabled = new Set(['叮咚买菜', '大润发小时达', '盒马鲜生'])
        return {
          scenes: input.scenes.map(scene => ({
            name: scene.name,
            enabled: enabled.has(scene.name),
            message: enabled.has(scene.name)
              ? '业务系统返回：场景已开通'
              : '业务系统返回：场景未开通',
          })),
        }
      },
    })
  ]
})

let streamText = ''

async function send(message: string) {
  messages.value.push({
    id: createId(),
    role: 'user',
    parts: [
      { type: 'text', text: message }
    ]
  })

  const config = '{"scenes":[{"name":"叮咚买菜","fee":"2%"},{"name":"大润发小时达","fee":"2%"}],"brand":[{"name":"盒马鲜生","coupon":"米面粮油提货券","faceValue":500,"fee":"2%"},{"name":"盒马鲜生","coupon":"米面粮油提货券","faceValue":200,"fee":"2%"}],"shopPickup":[{"name":"扫码提货","scope":["蛋糕品牌","百果园"]}]}'

  isRunning.value = true
  try {
    const result = await run(verifyAgent, config)

    messages.value.push({
      id: createId(),
      role: 'copilot',
      parts: [
        ...(result.text ? [{ type: 'text', text: result.text }] : []),
        ...result.toolCalls.map(call => ({
          type: 'tool-call',
          call: { name: call.name, args: call.args },
          result: call.error
            ? { ok: false, message: call.error }
            : { ok: true, message: JSON.stringify(call.result) },
        })),
      ]
    })
  }
  finally {
    isRunning.value = false
  }
}

// const client = ref({ runtime: { error: {} } })
const suggestions = ref([])
const messages = ref<any[]>([])
// omputed(() => agent.runtime.messages.value)
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


function createId(): string {
  return Math.random().toString(36).slice(2, 10)
}

function submit() {
  const text = draft.value.trim()

  send(text)
  // agent.runtime.run(text)
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
