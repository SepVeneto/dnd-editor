import type { FunctionTool, RunContext } from '@openai/agents'
import type { AgentHostTool, AgentToolDefinition } from './tool'
import type { AgentHostApi, EditorAgentContext } from './types'
import { Agent, handoff, tool } from '@openai/agents'
import { z } from 'zod'
import {
  buildMainAgentInstructions,
  MAIN_AGENT_NAME,
  RETURN_TO_MAIN_AGENT_TOOL_NAME,
} from './agentInstructions.ts'
import { isAgentSdkTool } from './tool.ts'

export const DEFAULT_AGENT_MODEL = 'qwen3.6-flash'
export const DEFAULT_AGENT_BFF_URL = 'http://localhost:4000/v1'

export interface CreateAgentsOptions {
  model?: string
  api: AgentHostApi
  tools?: AgentHostTool[]
  subAgents?: AgentSubAgentDefinition[]
}

/**
 * Host-owned specialist agent. The editor creates the SDK Agent and supplies
 * editor tools, but the host owns its role, instructions and business tools.
 */
export interface AgentSubAgentDefinition {
  name: string
  instructions: string
  handoffDescription: string
  tools?: AgentHostTool[]
  handoffToolName?: string
  handoffToolDescription?: string
  returnToMain?: boolean
  returnToolName?: string
  returnToolDescription?: string
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
      const context = runContext?.context
      if (!context)
        throw new Error('缺少当前 Agent Run 的 Context')

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
          context,
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
    description: '获取当前组件的稳定能力目录：标准 props、范围、custom type 和静态选项。规划组件和 DSL 前必须查询。',
    parameters: emptyParameters,
    strict: false,
    async execute(_input: unknown) {
      if (!api.editor?.getWidgets)
        throw new Error('宿主未提供 getWidgets API')
      return api.editor.getWidgets()
    },
  } as any)

  const addEditorNode = tool({
    name: 'add_editor_node',
    description: [
      '调用编辑器 DSL 添加一个组件。',
      'widget 必须来自 get_widgets 返回的组件目录；props、style 和 custom 必须符合该组件声明的标准字段与能力。',
      '工具只提交单条 add 操作，不解释或拼装业务数据。',
    ].join(''),
    parameters: {
      type: 'object',
      properties: {
        widget: { type: 'string' },
        props: { type: 'object', additionalProperties: true },
        style: { type: 'object', additionalProperties: true },
        custom: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
      required: ['widget'],
      additionalProperties: false,
    },
    strict: false,
    async execute(input: unknown, runContext?: RunContext<EditorAgentContext>) {
      if (!api.editor?.addNode)
        throw new Error('宿主未提供直接添加节点 API')
      return api.editor.addNode(input as Record<string, unknown>, runContext?.context)
    },
  } as any)

  const updateEditorNode = tool({
    name: 'update_editor_node',
    description: '通过编辑器 DSL 更新一个已有节点的标准 props、样式或 custom capability。',
    parameters: {
      type: 'object',
      properties: {
        uuid: { type: 'string' },
        props: { type: 'object', additionalProperties: true },
        style: { type: 'object', additionalProperties: true },
        custom: {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
      },
      required: ['uuid'],
      additionalProperties: false,
    },
    strict: false,
    async execute(input: unknown, runContext?: RunContext<EditorAgentContext>) {
      if (!api.editor?.applyDsl || !api.editor.getCurrentEditor)
        throw new Error('宿主未提供 DSL 执行 API')
      const operation = input as Record<string, any>
      const currentEditor = await api.editor.getCurrentEditor() as Record<string, any>
      return api.editor.applyDsl({
        dslVersion: '1.1',
        baseRevision: currentEditor?.revision ?? 0,
        scope: { mode: 'any', targets: [] },
        operations: [{
          op: 'update',
          uuid: operation.uuid,
          props: operation.props ?? {},
          style: operation.style ?? {},
          custom: Array.isArray(operation.custom) ? operation.custom : [],
        }],
      }, runContext?.context)
    },
  } as any)

  const deleteEditorNode = tool({
    name: 'delete_editor_node',
    description: '通过编辑器 DSL 删除一个节点；必须携带宿主生成的确认令牌。',
    parameters: {
      type: 'object',
      properties: {
        uuid: { type: 'string' },
        confirmToken: { type: 'string' },
      },
      required: ['uuid', 'confirmToken'],
      additionalProperties: false,
    },
    strict: false,
    async execute(input: unknown, runContext?: RunContext<EditorAgentContext>) {
      if (!api.editor?.applyDsl || !api.editor.getCurrentEditor)
        throw new Error('宿主未提供 DSL 执行 API')
      const operation = input as Record<string, any>
      const currentEditor = await api.editor.getCurrentEditor() as Record<string, any>
      return api.editor.applyDsl({
        dslVersion: '1.1',
        baseRevision: currentEditor?.revision ?? 0,
        scope: { mode: 'any', targets: [] },
        operations: [{
          op: 'delete',
          uuid: operation.uuid,
          confirmToken: operation.confirmToken,
        }],
      }, runContext?.context)
    },
  } as any)

  return [
    getCurrentEditor,
    getWidgets,
    addEditorNode,
    updateEditorNode,
    deleteEditorNode,
  ]
}

/**
 * llm-agent 的 Agent 定义已迁移到这里。业务工具通过 options.tools 注入，
 * 编辑器能力通过 options.api 注入，Agent 本身不持有宿主状态。
 */
export function createAgents(options: CreateAgentsOptions) {
  const hostTools = options.tools ?? []
  const model = options.model || DEFAULT_AGENT_MODEL
  const modelSettings = {
    reasoning: { effort: 'none' as const },
    text: { verbosity: 'low' as const },
  }
  const editorTools = createEditorTools(options.api)
  const adaptTools = (definitions: AgentHostTool[]) => definitions.map(item =>
    isAgentSdkTool(item)
      ? item
      : adaptHostTool(item, options.api),
  )
  const tools = [
    ...editorTools,
    ...adaptTools(hostTools),
  ]
  const subAgentDefinitions = options.subAgents ?? []
  const duplicateName = new Set<string>()
  for (const definition of subAgentDefinitions) {
    if (definition.name === MAIN_AGENT_NAME || duplicateName.has(definition.name))
      throw new Error(`子 Agent 名称重复或与主 Agent 冲突：${definition.name}`)
    duplicateName.add(definition.name)
  }

  const agent = new Agent({
    name: MAIN_AGENT_NAME,
    handoffDescription: '负责分诊请求并直接处理简单、局部的页面编辑命令。',
    model,
    modelSettings,
    instructions: buildMainAgentInstructions(),
    tools,
  })

  const subAgents = subAgentDefinitions.map((definition) => {
    const subAgentTools = [
      ...editorTools,
      ...adaptTools(hostTools),
      ...adaptTools(definition.tools ?? []),
    ]
    const subAgent = new Agent({
      name: definition.name,
      handoffDescription: definition.handoffDescription,
      model,
      modelSettings,
      instructions: definition.instructions,
      tools: subAgentTools,
    })
    if (definition.returnToMain !== false) {
      subAgent.handoffs = [
        handoff(agent, {
          toolNameOverride: definition.returnToolName
            ?? RETURN_TO_MAIN_AGENT_TOOL_NAME,
          toolDescriptionOverride: definition.returnToolDescription
            ?? `专业任务完成、取消，或用户切换到简单命令时，将控制权交还 ${MAIN_AGENT_NAME}。`,
        }),
      ]
    }
    return subAgent
  })

  agent.handoffs = subAgentDefinitions.map((definition, index) =>
    handoff(subAgents[index], {
      toolNameOverride: definition.handoffToolName,
      toolDescriptionOverride: definition.handoffToolDescription
        ?? definition.handoffDescription,
    }),
  )

  return {
    agent,
    subAgents,
    agents: [agent, ...subAgents],
  }
}
