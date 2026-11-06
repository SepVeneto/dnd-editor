import type { FunctionTool, RunContext } from '@openai/agents'
import type { AgentToolDefinition } from './tool'
import type { AgentEditorOperation, AgentHostApi, EditorAgentContext } from './types'
import { Agent, tool } from '@openai/agents'
import { z } from 'zod'
import { buildAgentInstructions } from './agentInstructions'
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
    description: '获取当前页面可供添加的组件列表、功能描述、布局适配性和配置规则。确定组件类型并为组件规划内容前应先查询。',
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
    instructions: buildAgentInstructions(),
    tools,
  })

  return {
    agent,
    agents: [agent],
  }
}
