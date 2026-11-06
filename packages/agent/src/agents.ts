import type { FunctionTool, RunContext } from '@openai/agents'
import type { AgentToolDefinition } from './tool'
import type { AgentEditorOperation, AgentHostApi, EditorAgentContext } from './types'
import { Agent, tool } from '@openai/agents'
import { z } from 'zod'
import {
  completeEditorOperation,
  prepareEditorOperation,
} from './editorContext'

export const DEFAULT_AGENT_MODEL = 'qwen3.6-flash'
export const DEFAULT_AGENT_BFF_URL = 'http://localhost:4000/v1'

export interface CreateAgentsOptions {
  model?: string
  api: AgentHostApi
  tools?: AgentToolDefinition[]
  getContext?: () => Record<string, unknown>
}

async function resolveApproval(
  definition: AgentToolDefinition,
  input: unknown,
) {
  const needsApproval = typeof definition.needsApproval === 'function'
    ? await definition.needsApproval(input)
    : definition.needsApproval

  if (!needsApproval)
    return true

  if (typeof window === 'undefined' || typeof window.confirm !== 'function')
    return false

  // eslint-disable-next-line no-alert
  return window.confirm(
    definition.approval?.message?.(input)
    ?? `是否执行工具 ${definition.name}？`,
  )
}

function adaptHostTool(
  definition: AgentToolDefinition,
  api: AgentHostApi,
  getContext: () => Record<string, unknown>,
): FunctionTool<any, any, any> {
  const zodParameters = definition.parameters
    ?? definition.inputSchema
    ?? z.object({ input: z.string().optional() })
  const { $schema: _schema, ...jsonParameters } = z.toJSONSchema(
    zodParameters,
    { io: 'input' },
  )

  return tool({
    name: definition.name,
    description: definition.description,
    parameters: jsonParameters,
    // Host tools may legitimately use optional fields. Non-strict mode accepts
    // their JSON schema without requiring every property to be nullable.
    strict: false,
    async execute(
      input: unknown,
      runContext?: RunContext<EditorAgentContext>,
    ) {
      if (!await resolveApproval(definition, input)) {
        return {
          ok: false,
          rejected: true,
          message: `用户不同意执行 ${definition.name}`,
        }
      }

      try {
        return await definition.execute(input, {
          api,
          getContext,
          context: runContext?.context ?? getContext() as EditorAgentContext,
        })
      }
      catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  } as any)
}

function createEditorTools(api: AgentHostApi): FunctionTool<any, any, any>[] {
  const emptyParameters = {
    type: 'object',
    properties: {},
    additionalProperties: false,
  }

  const getCurrentEditor = tool({
    name: 'get_current_editor',
    description: '获取当前编辑器文档、选中节点和页面结构。判断是初始化还是增删改前，应先读取当前内容。',
    parameters: emptyParameters,
    strict: false,
    async execute(_input: unknown) {
      if (!api.editor?.getCurrentEditor)
        throw new Error('宿主未提供 getCurrentEditor API')
      return api.editor.getCurrentEditor()
    },
  } as any)

  const getWidgets = tool({
    name: 'get_widgets',
    description: '获取当前页面可供添加的组件列表及组件配置规则。添加组件前应先查询。',
    parameters: emptyParameters,
    strict: false,
    async execute(_input: unknown) {
      if (!api.editor?.getWidgets)
        throw new Error('宿主未提供 getWidgets API')
      return api.editor.getWidgets()
    },
  } as any)

  const editorOperator = tool({
    name: 'editor_operator',
    description: [
      '通过节点 UUID 添加、编辑、删除或移动编辑器组件。',
      'add 的 items 由业务工具写入本次 Run 的 Context 后自动注入，禁止在参数中生成 items。',
    ].join(''),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'edit', 'delete', 'move'],
          description: '操作类型',
        },
        target: {
          type: 'string',
          description: '编辑、删除、移动使用的节点 UUID；add 不使用该字段，组件始终添加到页面根节点',
        },
        widget: {
          type: 'string',
          description: 'add 时使用的组件类型 ID；必须来自 get_widgets',
        },
        changes: {
          type: 'object',
          description: 'edit 时合并到节点 data 的字段',
          additionalProperties: true,
        },
        style: {
          type: 'object',
          description: 'edit 时合并到节点 style 的字段',
          additionalProperties: true,
        },
        before: {
          type: 'string',
          description: 'move 时插入到该节点之前',
        },
        after: {
          type: 'string',
          description: 'move 时插入到该节点之后',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    strict: false,
    async execute(
      rawOperation: unknown,
      runContext?: RunContext<EditorAgentContext>,
    ) {
      if (!api.editor?.operateEditor)
        throw new Error('宿主未提供 operateEditor API')

      const context = runContext?.context
      if (!context)
        throw new Error('缺少当前 Agent Run 的 Context')

      const prepared = prepareEditorOperation(rawOperation, context)
      if (prepared.error)
        return { ok: false, error: prepared.error }

      try {
        const result = await api.editor.operateEditor(
          prepared.operation as AgentEditorOperation,
          context,
        )
        completeEditorOperation(context, prepared, result)
        return result
      }
      catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  } as any)

  return [getCurrentEditor, getWidgets, editorOperator]
}

/**
 * llm-agent 的 Agent 定义已迁移到这里。业务工具通过 options.tools 注入，
 * 编辑器能力通过 options.api 注入，Agent 本身不持有宿主状态。
 */
export function createAgents(options: CreateAgentsOptions) {
  const getContext = options.getContext ?? (() => ({}))
  const hostTools = options.tools ?? []
  const tools = [
    ...createEditorTools(options.api),
    ...hostTools.map(item =>
      adaptHostTool(item, options.api, getContext),
    ),
  ]

  const agent = new Agent({
    name: 'Diy Copilot',
    model: options.model || DEFAULT_AGENT_MODEL,
    modelSettings: {
      reasoning: { effort: 'none' },
      text: { verbosity: 'low' },
    },
    instructions: [
      '你是一个 DIY 页面设计助手，负责通过宿主提供的 API 和业务工具帮助用户完成页面设计。',
      '收到页面设计或编辑请求后，先调用 get_current_editor，结合页面现状、当前对话和附件内容判断工作模式。',
      '工作模式分为“初始化”和“增量修改”。用户提供装修清单、文档或整页设计需求时，进入初始化；用户要求对当前页面的具体节点或局部内容进行新增、修改、删除、移动时，进入增量修改。',
      '用户上传图片作为视觉参考时，先分析图片中的整体布局、信息层级、分区结构、栅格与间距、比例、颜色和组件关系，再结合 get_current_editor 与 get_widgets 的可用能力落地。参考图片可以用于初始化整页，也可以用于增量修改局部布局。',
      '只根据图片中清晰可辨的内容做判断。图片中的文案、价格、商品信息或接口数据无法确认时，不要臆造；需要业务数据时仍须调用宿主提供的业务工具。',
      '即使请求中包含多项内容，只要用户明确表示添加到当前页面或保留现有内容，仍属于增量修改。页面已有实质内容但用户提供整页清单且未明确是否覆盖时，先询问用户是覆盖初始化还是增量追加，不要擅自清空或覆盖。',
      '执行初始化，或增量修改需要新增组件、调整组件类型时，调用 get_widgets 确认组件类型、配置规则和数据结构。',
      '只通过 editor_operator 修改编辑器，不要臆造节点 UUID 或组件类型。',
      '所有通过 editor_operator add 的组件都平铺添加到页面根节点，不存在嵌套添加；add 时不要传 target。',
      '添加业务组件时，必须先调用能准备组件数据的业务工具；完整 items 会写入本次 Run 的 Context 并由 editor_operator 自动注入。',
      '不要在 editor_operator 参数中生成 items，也不要自行伪造商品、场景等业务数据。',
      '业务工具准备好的 items 会被一次添加操作消费；若要再次添加，必须重新调用业务工具。',
      '业务数据只能通过已注册的业务工具获取或写入，不要伪造接口结果。',
      '写入或不可逆操作需要用户明确同意；完成后用简洁的中文总结实际发生的变化。',
    ].join('\n'),
    tools,
  })

  return {
    agent,
    agents: [agent],
  }
}
