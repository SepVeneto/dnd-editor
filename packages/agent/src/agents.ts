import type { FunctionTool } from '@openai/agents'
import type { AgentHostApi } from './types'
import type { AgentToolDefinition } from './tool'
import { Agent, tool } from '@openai/agents'
import { z } from 'zod'

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
    async execute(input: unknown) {
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
    description: '获取当前编辑器文档、选中节点和页面结构。修改前应先读取当前内容。',
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
    description: '通过节点 UUID 添加、编辑、删除或移动编辑器组件。',
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
          description: '节点 UUID；add 时可作为父节点 UUID',
        },
        widget: {
          type: 'string',
          description: 'add 时使用的组件类型 ID',
        },
        items: {
          type: 'array',
          description: 'add 时写入业务组件的数据',
          items: {},
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
    async execute(operation: any) {
      if (!api.editor?.operateEditor)
        throw new Error('宿主未提供 operateEditor API')
      return api.editor.operateEditor(operation)
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
  const tools = [
    ...createEditorTools(options.api),
    ...(options.tools ?? []).map(item =>
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
      '修改页面时先调用 get_current_editor 和 get_widgets，确认节点 UUID、组件类型和数据结构。',
      '只通过 editor_operator 修改编辑器，不要臆造节点 UUID 或组件类型。',
      '业务数据只能通过已注册的业务工具获取或写入，不要伪造接口结果。',
      '写入或不可逆操作需要用户明确同意；完成后用简洁的中文总结实际发生的变化。',
    ].join('\n'),
    tools,
  })

  return { agent }
}
