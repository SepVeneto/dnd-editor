import type { FunctionTool, RunContext } from '@openai/agents'
import type {
  AgentEditorDsl,
  AgentHostApi,
  EditorAgentContext,
} from './types'
import { tool } from '@openai/agents'

export const GET_CURRENT_EDITOR_TOOL_NAME = 'get_current_editor'
export const GET_WIDGETS_TOOL_NAME = 'get_widgets'
export const VALIDATE_EDITOR_DSL_TOOL_NAME = 'validate_editor_dsl'
export const APPLY_EDITOR_DSL_TOOL_NAME = 'apply_editor_dsl'
export const UNDO_EDITOR_DSL_TOOL_NAME = 'undo_editor_dsl'

const emptyParameters = {
  type: 'object',
  properties: {},
  additionalProperties: false,
}

const stringRecord = {
  type: 'object',
  additionalProperties: true,
}

const customOperation = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    capability: { type: 'string' },
    args: stringRecord,
  },
  required: ['type', 'capability', 'args'],
  additionalProperties: false,
}

const editorDslParameters = {
  type: 'object',
  properties: {
    dslVersion: { const: '1.1' },
    baseRevision: { type: 'number' },
    scope: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['style_only', 'content_only', 'layout_only', 'any'],
        },
        targets: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['mode', 'targets'],
      additionalProperties: false,
    },
    operations: {
      type: 'array',
      minItems: 1,
      items: {
        oneOf: [
          {
            type: 'object',
            properties: {
              op: { const: 'add' },
              key: { type: 'string' },
              widget: { type: 'string' },
              placement: {
                type: 'object',
                properties: {
                  afterUuid: { type: 'string' },
                  beforeUuid: { type: 'string' },
                  afterKey: { type: 'string' },
                  beforeKey: { type: 'string' },
                  group: { type: 'string' },
                },
                additionalProperties: false,
              },
              props: stringRecord,
              style: stringRecord,
              custom: {
                type: 'array',
                items: customOperation,
              },
            },
            required: ['op', 'key', 'widget'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              op: { const: 'update' },
              uuid: { type: 'string' },
              props: stringRecord,
              style: stringRecord,
              custom: {
                type: 'array',
                items: customOperation,
              },
            },
            required: ['op', 'uuid'],
            additionalProperties: false,
          },
          {
            type: 'object',
            properties: {
              op: { const: 'delete' },
              uuid: { type: 'string' },
            },
            required: ['op', 'uuid'],
            additionalProperties: false,
          },
        ],
      },
    },
  },
  required: ['dslVersion', 'baseRevision', 'scope', 'operations'],
  additionalProperties: false,
}

const dslEnvelopeParameters = {
  type: 'object',
  properties: {
    dsl: editorDslParameters,
  },
  required: ['dsl'],
  additionalProperties: false,
}

export interface CreateEditorDslToolsOptions {
  /** Include the current editor snapshot query. Defaults to true. */
  currentEditor?: boolean
  /** Include the widget capability catalog query. Defaults to true. */
  widgets?: boolean
  /** Include deterministic DSL validation. Defaults to true. */
  validate?: boolean
  /** Include revision-bound undo. Defaults to true. */
  undo?: boolean
}

function contextValue(runContext?: RunContext<EditorAgentContext>) {
  return runContext?.context
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withoutWidgetImplementation(widget: unknown): unknown {
  if (!isRecord(widget))
    return widget

  const {
    defaultStyle: _defaultStyle,
    defaultData: _defaultData,
    attributes: _attributes,
    fields: _fields,
    customTypes: _customTypes,
    staticOptions: _staticOptions,
    ...capability
  } = widget
  return capability
}

function widgetCandidates(result: unknown): unknown {
  const candidates = (items: unknown[]) => items
    .filter(item => !isRecord(item) || item.type !== 'page')
    .map(withoutWidgetImplementation)

  if (Array.isArray(result))
    return candidates(result)

  if (isRecord(result) && Array.isArray(result.widgets))
    return { ...result, widgets: candidates(result.widgets) }

  return result
}

/**
 * Build the complete model-facing editor contract. These tools are intended
 * for host-owned sub-agents; the main dispatcher never receives them.
 */
export function createEditorDslTools(
  api: AgentHostApi,
  options: CreateEditorDslToolsOptions = {},
): FunctionTool<any, any, any>[] {
  const tools: FunctionTool<any, any, any>[] = []

  if (options.currentEditor !== false) {
    tools.push(tool({
      name: GET_CURRENT_EDITOR_TOOL_NAME,
      description: '读取当前编辑器文档、选中节点和 revision。应用 DSL 前必须先调用。',
      parameters: emptyParameters,
      strict: false,
      async execute() {
        if (!api.editor?.getCurrentEditor)
          throw new Error('宿主未提供 getCurrentEditor API')
        return api.editor.getCurrentEditor()
      },
    } as any))
  }

  if (options.widgets !== false) {
    tools.push(tool({
      name: GET_WIDGETS_TOOL_NAME,
      description: '读取可作为页面子组件的组件列表，不包括 page、实现字段或组件初始化数据。',
      parameters: emptyParameters,
      strict: false,
      async execute() {
        if (!api.editor?.getWidgets)
          throw new Error('宿主未提供 getWidgets API')
        return widgetCandidates(await api.editor.getWidgets())
      },
    } as any))
  }

  if (options.validate !== false) {
    tools.push(tool({
      name: VALIDATE_EDITOR_DSL_TOOL_NAME,
      description: '校验完整编辑器 DSL，不修改文档；返回 issues 和 normalized DSL。',
      parameters: dslEnvelopeParameters,
      strict: false,
      async execute(
        input: { dsl: AgentEditorDsl },
        runContext?: RunContext<EditorAgentContext>,
      ) {
        if (!api.editor?.validateDsl)
          throw new Error('宿主未提供 validateDsl API')
        return api.editor.validateDsl(input.dsl, contextValue(runContext))
      },
    } as any))
  }

  tools.push(tool({
    name: APPLY_EDITOR_DSL_TOOL_NAME,
    description: [
      '一次性提交完整、版本化的编辑器 DSL。',
      'DSL 基于 get_current_editor 返回的 revision，可批量包含 add/update/delete 操作。',
      '无法确定节点、组件字段或业务数据时不得猜测。',
    ].join(''),
    parameters: dslEnvelopeParameters,
    strict: false,
    async execute(
      input: { dsl: AgentEditorDsl },
      runContext?: RunContext<EditorAgentContext>,
    ) {
      if (!api.editor?.applyDsl)
        throw new Error('宿主未提供 applyDsl API')

      const context = contextValue(runContext)
      if (api.editor.validateDsl) {
        const validation = await api.editor.validateDsl(input.dsl, context)
        if (!validation.ok)
          return validation
      }

      return api.editor.applyDsl(input.dsl, context)
    },
  } as any))

  if (options.undo !== false) {
    tools.push(tool({
      name: UNDO_EDITOR_DSL_TOOL_NAME,
      description: '按 revision 撤销最近一次 DSL 操作。',
      parameters: {
        type: 'object',
        properties: {
          revision: { type: 'number' },
        },
        additionalProperties: false,
      },
      strict: false,
      async execute(input: { revision?: number }) {
        if (!api.editor?.undo)
          throw new Error('宿主未提供 undo API')
        return api.editor.undo(input.revision)
      },
    } as any))
  }

  return tools
}

/** Convenience alias for hosts that refer to this contract as editor tools. */
export const createEditorTools = createEditorDslTools
