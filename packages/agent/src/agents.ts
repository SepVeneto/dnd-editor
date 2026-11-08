import type { FunctionTool, RunContext } from '@openai/agents'
import type { AgentHostTool, AgentToolDefinition } from './tool'
import type { AgentHostApi, EditorAgentContext } from './types'
import { Agent, handoff, tool } from '@openai/agents'
import { IR_RESOURCE_TYPES } from '@sepveneto/dnde-core'
import { z } from 'zod'
import {
  buildChecklistAgentInstructions,
  buildMainAgentInstructions,
  CONFIG_CHECKLIST_AGENT_NAME,
  CONFIG_CHECKLIST_HANDOFF_TOOL_NAME,
  CONFIG_CHECKLIST_RETURN_TOOL_NAME,
  MAIN_AGENT_NAME,
} from './agentInstructions.ts'
import { initializeEditorContext } from './initialization.ts'
import { isAgentSdkTool } from './tool.ts'

export const DEFAULT_AGENT_MODEL = 'qwen3.6-flash'
export const DEFAULT_AGENT_BFF_URL = 'http://localhost:4000/v1'

function requireInitializationIr(context?: EditorAgentContext) {
  if (context?.initialization && typeof context.initialization === 'object') {
    const initialization = context.initialization as Record<string, unknown>
    if (initialization.ir && typeof initialization.ir === 'object')
      return undefined
  }
  return {
    ok: false,
    error: '尚未生成 IR，禁止开始编辑。请先调用 prepare_initialization。',
  }
}

export interface CreateAgentsOptions {
  model?: string
  api: AgentHostApi
  tools?: AgentHostTool[]
  getContext?: () => Record<string, unknown>
  debugStartAt?: 'prepare_initialization'
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
    description: '获取当前组件的稳定能力目录：标准 props、范围、custom type 和静态选项。规划 IR 和 DSL 前必须查询。',
    parameters: emptyParameters,
    strict: false,
    async execute(_input: unknown) {
      if (!api.editor?.getWidgets)
        throw new Error('宿主未提供 getWidgets API')
      return api.editor.getWidgets()
    },
  } as any)

  const prepareInitialization = tool({
    name: 'prepare_initialization',
    description: [
      '提交配置清单解析后的初始化 IR。工具会规范化 IR、绑定当前文档 revision，',
      '并返回需调用的独立资源查询工具；本工具不执行业务资源查询。',
      'components 数组顺序即组件顺序，不要提交 placement。',
      '资源只提交所属组件、封闭枚举 type、required 和 query；H5 外接场景使用 app，卡券品牌使用 coupon。',
      '门店提货存在时增加 shopPickup 组件并忽略具体内容。',
      '不要提交位置 ID、资源 ID、classification、resolution 或查询结果；宿主会为每个组件位置生成唯一 locationId 并写入 Context。',
    ].join(''),
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: '对配置清单目标的简短描述',
        },
        components: {
          type: 'array',
          description: '配置清单要求的组件及批内稳定 key',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              type: { type: 'string' },
            },
            required: ['key', 'type'],
            additionalProperties: false,
          },
        },
        resources: {
          type: 'array',
          description: '配置清单中的 link/app/coupon 资源需求',
          items: {
            type: 'object',
            properties: {
              component: { type: 'string' },
              type: { type: 'string', enum: [...IR_RESOURCE_TYPES] },
              required: { type: 'boolean' },
              query: { type: 'string' },
            },
            required: ['component', 'type', 'required', 'query'],
            additionalProperties: false,
          },
        },
      },
      required: ['intent', 'components', 'resources'],
      additionalProperties: false,
    },
    strict: false,
    async execute(rawIr: unknown, runContext?: RunContext<EditorAgentContext>) {
      const context = runContext?.context
      if (!context)
        throw new Error('缺少当前 Agent Run 的 Context')

      return initializeEditorContext(rawIr, context, api)
    },
  } as any)

  const addEditorNode = tool({
    name: 'add_editor_node',
    description: [
      '调用编辑器 DSL 添加一个组件。',
      '模型只传 resourceId；宿主从 Context 中读取该位置对应的 widget、标准属性和业务资源。',
      '工具本身不校验顺序、资源状态或参数内容，只提交单条 add 操作。',
    ].join(''),
    parameters: {
      type: 'object',
      properties: {
        resourceId: { type: 'string' },
      },
      required: ['resourceId'],
      additionalProperties: false,
    },
    strict: false,
    async execute(input: unknown, runContext?: RunContext<EditorAgentContext>) {
      if (!api.editor?.addNode)
        throw new Error('宿主未提供直接添加节点 API')
      const missingIr = requireInitializationIr(runContext?.context)
      if (missingIr)
        return missingIr
      return api.editor.addNode(
        {
          locationId: (input as { resourceId?: unknown })?.resourceId,
        },
        runContext?.context,
      )
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
      const missingIr = requireInitializationIr(runContext?.context)
      if (missingIr)
        return missingIr
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
      const missingIr = requireInitializationIr(runContext?.context)
      if (missingIr)
        return missingIr
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
    prepareInitialization,
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
  const getContext = options.getContext ?? (() => ({}))
  const hostTools = options.tools ?? []
  const model = options.model || DEFAULT_AGENT_MODEL
  const modelSettings = {
    reasoning: { effort: 'none' as const },
    text: { verbosity: 'low' as const },
  }
  const tools = [
    ...createEditorTools(options.api),
    ...hostTools.map(item =>
      isAgentSdkTool(item)
        ? item
        : adaptHostTool(item, options.api, getContext),
    ),
  ]
  const checklistAgent = new Agent({
    name: CONFIG_CHECKLIST_AGENT_NAME,
    handoffDescription: '专门处理配置清单、需求文档、整页方案和多组件配置要求。',
    model,
    modelSettings,
    instructions: buildChecklistAgentInstructions({
      debugStartAt: options.debugStartAt,
    }),
    tools,
  })

  const agent = new Agent({
    name: MAIN_AGENT_NAME,
    handoffDescription: '负责分诊请求并直接处理简单、局部的页面编辑命令。',
    model,
    modelSettings,
    instructions: buildMainAgentInstructions(),
    tools,
    handoffs: [
      handoff(checklistAgent, {
        toolNameOverride: CONFIG_CHECKLIST_HANDOFF_TOOL_NAME,
        toolDescriptionOverride: '用户提供配置清单、需求文档、整页方案或多组件配置要求时，移交配置清单子 Agent。',
      }),
    ],
  })

  checklistAgent.handoffs = [
    handoff(agent, {
      toolNameOverride: CONFIG_CHECKLIST_RETURN_TOOL_NAME,
      toolDescriptionOverride: '配置清单处理完成、被取消，或用户切换到简单命令时，将控制权交还主 Agent。',
    }),
  ]

  return {
    agent,
    checklistAgent,
    agents: [agent, checklistAgent],
  }
}
