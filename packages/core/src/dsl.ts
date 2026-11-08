import type {
  CapabilityCatalog,
  FieldScope,
  WidgetCapability,
  WidgetCustomCapability,
} from './capability'
import {
  findCustomCapability,
  findFieldCapability,
  findWidgetCapability,
} from './capability'

export type DslScopeMode = 'style_only' | 'content_only' | 'layout_only' | 'any'

export interface DslScope {
  mode: DslScopeMode
  targets: string[]
}

export interface DslPlacement {
  afterUuid?: string
  beforeUuid?: string
  afterKey?: string
  beforeKey?: string
  group?: string
}

export interface DslCustomOperation {
  type: string
  capability: string
  args: {
    queries?: DslResourceQuery[]
    [key: string]: unknown
  }
}

export interface DslResourceQuery {
  type: string
  query: string
}

export interface DslAddOperation {
  op: 'add'
  key: string
  widget: string
  placement?: DslPlacement
  props?: Record<string, unknown>
  style?: Record<string, unknown>
  custom?: DslCustomOperation[]
}

export interface DslUpdateOperation {
  op: 'update'
  uuid: string
  props?: Record<string, unknown>
  style?: Record<string, unknown>
  custom?: DslCustomOperation[]
}

export interface DslDeleteOperation {
  op: 'delete'
  uuid: string
  confirmToken?: string
}

export type DslOperation = DslAddOperation | DslUpdateOperation | DslDeleteOperation

export interface EditorDsl {
  dslVersion: '1.1'
  baseRevision: number
  scope: DslScope
  operations: DslOperation[]
}

export interface DslResolvedResource {
  status: 'resolved' | 'not_found' | 'ambiguous' | 'unavailable'
  type: string
  query: string
  value?: unknown
  sourceTool?: string
  underlyingId?: string
}

export interface DslResourceContext {
  resources: DslResolvedResource[]
}

export interface DslNodeSummary {
  uuid: string
  type: string
  parentUuid?: string
}

export interface DslDocumentSnapshot {
  revision: number
  nodes: DslNodeSummary[]
  /** Tokens issued by the host after previewing destructive operations. */
  confirmTokens?: string[]
}

export interface DslIssue {
  code: string
  path: string
  message: string
}

export interface DslValidationResult {
  ok: boolean
  issues: DslIssue[]
  normalized?: EditorDsl
}

export interface DslValidationOptions {
  catalog: CapabilityCatalog
  snapshot: DslDocumentSnapshot
  resources?: DslResourceContext
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeResourceQuery(value: string) {
  return value.trim().replace(/\s+/g, '').toLocaleLowerCase()
}

function isScope(value: unknown): value is FieldScope {
  return value === 'style' || value === 'content' || value === 'layout'
}

function allowsScope(mode: DslScopeMode, scope: FieldScope) {
  if (mode === 'any')
    return true
  return (
    (mode === 'style_only' && scope === 'style')
    || (mode === 'content_only' && scope === 'content')
    || (mode === 'layout_only' && scope === 'layout')
  )
}

function matchesValueType(field: ReturnType<typeof findFieldCapability>, value: unknown) {
  if (!field)
    return false

  switch (field.valueType) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'integer':
      return Number.isInteger(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'enum':
      return field.enum?.some(item => Object.is(item, value)) ?? true
    case 'array':
      return Array.isArray(value)
    case 'object':
      return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    default:
      return true
  }
}

function validateFieldValue(
  widget: WidgetCapability,
  key: string,
  value: unknown,
  scopeMode: DslScopeMode,
  path: string,
  issues: DslIssue[],
): boolean {
  const field = findFieldCapability(widget, key)
  if (!field) {
    issues.push({
      code: 'unknown_prop',
      path,
      message: `${widget.type} 没有登记标准字段 ${key}`,
    })
    return false
  }
  if (field.readOnly) {
    issues.push({
      code: 'read_only_prop',
      path,
      message: `${widget.type}.${key} 为只读字段`,
    })
    return false
  }
  if (!allowsScope(scopeMode, field.scope)) {
    issues.push({
      code: 'scope_violation',
      path,
      message: `${widget.type}.${key} 属于 ${field.scope}，当前 scope 不允许写入`,
    })
    return false
  }
  if (!matchesValueType(field, value)) {
    issues.push({
      code: 'invalid_prop_type',
      path,
      message: `${widget.type}.${key} 需要 ${field.valueType} 类型`,
    })
    return false
  }
  if (typeof value === 'number' && field.minimum !== undefined && value < field.minimum) {
    issues.push({
      code: 'prop_below_minimum',
      path,
      message: `${widget.type}.${key} 不能小于 ${field.minimum}`,
    })
    return false
  }
  if (typeof value === 'number' && field.maximum !== undefined && value > field.maximum) {
    issues.push({
      code: 'prop_above_maximum',
      path,
      message: `${widget.type}.${key} 不能大于 ${field.maximum}`,
    })
    return false
  }
  return true
}

function validateProps(
  widget: WidgetCapability,
  props: unknown,
  container: 'props' | 'style',
  scopeMode: DslScopeMode,
  path: string,
  issues: DslIssue[],
) {
  if (props === undefined)
    return
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    issues.push({
      code: 'invalid_props',
      path,
      message: 'props 必须是对象',
    })
    return
  }

  Object.entries(props as Record<string, unknown>).forEach(([key, value]) => {
    const field = findFieldCapability(widget, key)
    if (field && container === 'props' && field.scope === 'style') {
      issues.push({
        code: 'style_field_in_props',
        path: `${path}.${key}`,
        message: `${widget.type}.${key} 是样式字段，必须写入 style`,
      })
      return
    }
    if (field && container === 'style' && field.scope !== 'style') {
      issues.push({
        code: 'non_style_field_in_style',
        path: `${path}.${key}`,
        message: `${widget.type}.${key} 不是样式字段，不能写入 style`,
      })
      return
    }
    validateFieldValue(widget, key, value, scopeMode, `${path}.${key}`, issues)
  })
}

function validateCustom(
  widget: WidgetCapability,
  custom: unknown,
  scopeMode: DslScopeMode,
  resources: DslResourceContext,
  path: string,
  issues: DslIssue[],
) {
  if (custom === undefined)
    return
  if (!Array.isArray(custom)) {
    issues.push({
      code: 'invalid_custom_operations',
      path,
      message: 'custom 必须是能力操作数组',
    })
    return
  }

  custom.forEach((rawOperation, index) => {
    const operation = asRecord(rawOperation)
    const type = typeof operation.type === 'string' ? operation.type : ''
    const name = typeof operation.capability === 'string' ? operation.capability : ''
    const capability: WidgetCustomCapability | undefined = findCustomCapability(widget, type, name)

    if (!capability) {
      issues.push({
        code: 'unsupported_capability',
        path: `${path}[${index}]`,
        message: `${widget.type} 未登记 custom type ${type} 的能力 ${name}`,
      })
      return
    }
    if (!allowsScope(scopeMode, capability.writableScope)) {
      issues.push({
        code: 'scope_violation',
        path: `${path}[${index}]`,
        message: `能力 ${name} 属于 ${capability.writableScope}，当前 scope 不允许写入`,
      })
    }

    const args = asRecord(operation.args)
    const queries = Array.isArray(args.queries)
      ? args.queries.filter((query): query is DslResourceQuery => {
          const item = asRecord(query)
          return typeof item.type === 'string' && typeof item.query === 'string'
        })
      : []

    if (Array.isArray(args.queries) && queries.length !== args.queries.length) {
      issues.push({
        code: 'invalid_resource_query',
        path: `${path}[${index}].args.queries`,
        message: '资源引用必须包含 type 和 query',
      })
    }
    if (capability.maxItems !== undefined && queries.length > capability.maxItems) {
      issues.push({
        code: 'resource_limit_exceeded',
        path: `${path}[${index}].args.queries`,
        message: `${name} 最多接受 ${capability.maxItems} 个资源`,
      })
    }

    queries.forEach((query, queryIndex) => {
      const resource = resources.resources.find(item =>
        item.type === query.type
        && normalizeResourceQuery(item.query) === normalizeResourceQuery(query.query),
      )
      if (!resource) {
        issues.push({
          code: 'unresolved_resource_query',
          path: `${path}[${index}].args.queries[${queryIndex}]`,
          message: `资源 ${query.type}:${query.query} 未在本轮解析`,
        })
        return
      }
      if (resource.status !== 'resolved') {
        issues.push({
          code: 'resource_not_resolved',
          path: `${path}[${index}].args.queries[${queryIndex}]`,
          message: `资源 ${query.type}:${query.query} 状态为 ${resource.status}`,
        })
        return
      }
      if (capability.resourceTypes.length && !capability.resourceTypes.includes(resource.type)) {
        issues.push({
          code: 'resource_type_mismatch',
          path: `${path}[${index}].args.queries[${queryIndex}]`,
          message: `${name} 不接受 ${resource.type} 资源`,
        })
      }
    })
  })
}

function placementCount(placement: DslPlacement) {
  return ['afterUuid', 'beforeUuid', 'afterKey', 'beforeKey']
    .filter(key => typeof (placement as any)[key] === 'string' && (placement as any)[key])
    .length
}

/**
 * Deterministic, side-effect-free validation for the versioned editor DSL.
 * The host must validate before applying; the executor repeats critical checks
 * against the live document.
 */
export function validateEditorDsl(
  input: unknown,
  options: DslValidationOptions,
): DslValidationResult {
  const issues: DslIssue[] = []
  const dsl = asRecord(input)
  const operations = Array.isArray(dsl.operations) ? dsl.operations : []
  const scope = asRecord(dsl.scope)
  const scopeMode = scope.mode

  if (dsl.dslVersion !== '1.1') {
    issues.push({
      code: 'unsupported_dsl_version',
      path: 'dslVersion',
      message: '仅支持 dslVersion 1.1',
    })
  }
  if (dsl.baseRevision !== options.snapshot.revision) {
    issues.push({
      code: 'stale_revision',
      path: 'baseRevision',
      message: `DSL 基于 revision ${String(dsl.baseRevision)}，当前为 ${options.snapshot.revision}`,
    })
  }
  if (
    scopeMode !== 'style_only'
    && scopeMode !== 'content_only'
    && scopeMode !== 'layout_only'
    && scopeMode !== 'any'
  ) {
    issues.push({
      code: 'invalid_scope',
      path: 'scope.mode',
      message: 'scope.mode 必须是 style_only/content_only/layout_only/any',
    })
  }
  const scopeTargets = Array.isArray(scope.targets)
    ? scope.targets.filter((target): target is string => typeof target === 'string')
    : []

  if (!operations.length) {
    issues.push({
      code: 'empty_operations',
      path: 'operations',
      message: 'DSL 至少需要一个操作',
    })
  }

  const nodeUuids = new Set(options.snapshot.nodes.map(node => node.uuid))
  const addKeys = new Set<string>()
  const normalizedOperations: DslOperation[] = []

  operations.forEach((rawOperation, index) => {
    const operation = asRecord(rawOperation)
    const path = `operations[${index}]`
    const op = operation.op
    if (op !== 'add' && op !== 'update' && op !== 'delete') {
      issues.push({
        code: 'unsupported_operation',
        path: `${path}.op`,
        message: `不支持的操作 ${String(op)}`,
      })
      return
    }

    if (op === 'add') {
      const key = typeof operation.key === 'string' ? operation.key : ''
      const widgetType = typeof operation.widget === 'string' ? operation.widget : ''
      const widget = findWidgetCapability(options.catalog, widgetType)
      if (!key) {
        issues.push({ code: 'missing_key', path: `${path}.key`, message: 'add 必须提供批内唯一 key' })
      }
      else if (addKeys.has(key)) {
        issues.push({ code: 'duplicate_key', path: `${path}.key`, message: `批内 key 重复：${key}` })
      }
      if (!widget) {
        issues.push({
          code: 'unknown_widget',
          path: `${path}.widget`,
          message: `组件能力目录中不存在 ${widgetType}`,
        })
      }

      const placement = asRecord(operation.placement)
      if (placementCount(placement) > 1) {
        issues.push({
          code: 'ambiguous_placement',
          path: `${path}.placement`,
          message: 'placement 只能指定一个相对位置',
        })
      }
      for (const keyName of ['afterKey', 'beforeKey'] as const) {
        const reference = typeof placement[keyName] === 'string' ? placement[keyName] : ''
        if (reference && !addKeys.has(reference)) {
          issues.push({
            code: 'unknown_batch_key',
            path: `${path}.placement.${keyName}`,
            message: `批内 key ${reference} 尚未创建`,
          })
        }
      }
      for (const uuidName of ['afterUuid', 'beforeUuid'] as const) {
        const reference = typeof placement[uuidName] === 'string' ? placement[uuidName] : ''
        if (reference && !nodeUuids.has(reference)) {
          issues.push({
            code: 'unknown_node',
            path: `${path}.placement.${uuidName}`,
            message: `节点 ${reference} 不存在`,
          })
        }
      }

      if (widget) {
        const customOperations = operation.custom === undefined ? [] : operation.custom
        validateProps(widget, operation.props, 'props', scopeMode as DslScopeMode, `${path}.props`, issues)
        validateProps(widget, operation.style, 'style', scopeMode as DslScopeMode, `${path}.style`, issues)
        validateCustom(widget, customOperations, scopeMode as DslScopeMode, options.resources ?? { resources: [] }, `${path}.custom`, issues)
      }

      if (key)
        addKeys.add(key)
      normalizedOperations.push({
        op,
        key,
        widget: widgetType,
        placement: placement as DslPlacement,
        props: asRecord(operation.props),
        style: asRecord(operation.style),
        custom: Array.isArray(operation.custom) ? operation.custom as DslCustomOperation[] : [],
      })
      return
    }

    const uuid = typeof operation.uuid === 'string' ? operation.uuid : ''
    const node = options.snapshot.nodes.find(item => item.uuid === uuid)
    if (!node) {
      issues.push({
        code: 'unknown_node',
        path: `${path}.uuid`,
        message: `节点 ${uuid || '(空)'} 不存在`,
      })
    }
    if (scopeTargets.length && !scopeTargets.includes(uuid)) {
      issues.push({
        code: 'target_outside_scope',
        path: `${path}.uuid`,
        message: `节点 ${uuid} 不在 scope.targets 内`,
      })
    }

    if (op === 'delete') {
      if (!operation.confirmToken) {
        issues.push({
          code: 'delete_confirmation_required',
          path: `${path}.confirmToken`,
          message: '删除操作必须携带一次性确认令牌',
        })
      }
      else if (!options.snapshot.confirmTokens?.includes(String(operation.confirmToken))) {
        issues.push({
          code: 'invalid_confirm_token',
          path: `${path}.confirmToken`,
          message: '删除确认令牌无效或已过期',
        })
      }
      normalizedOperations.push({ op, uuid, confirmToken: String(operation.confirmToken ?? '') })
      return
    }

    const widget = node ? findWidgetCapability(options.catalog, node.type) : undefined
    if (node && widget) {
      validateProps(widget, operation.props, 'props', scopeMode as DslScopeMode, `${path}.props`, issues)
      validateProps(widget, operation.style, 'style', scopeMode as DslScopeMode, `${path}.style`, issues)
      validateCustom(widget, operation.custom, scopeMode as DslScopeMode, options.resources ?? { resources: [] }, `${path}.custom`, issues)
    }
    normalizedOperations.push({
      op,
      uuid,
      props: asRecord(operation.props),
      style: asRecord(operation.style),
      custom: Array.isArray(operation.custom) ? operation.custom as DslCustomOperation[] : [],
    })
  })

  if (
    scopeTargets.some(target => !nodeUuids.has(target))
  ) {
    issues.push({
      code: 'unknown_scope_target',
      path: 'scope.targets',
      message: 'scope.targets 包含不存在的节点',
    })
  }

  return {
    ok: issues.length === 0,
    issues,
    ...(issues.length
      ? {}
      : {
          normalized: {
            dslVersion: '1.1',
            baseRevision: options.snapshot.revision,
            scope: {
              mode: scopeMode as DslScopeMode,
              targets: scopeTargets,
            },
            operations: normalizedOperations,
          },
        }),
  }
}

export function isStyleField(widget: WidgetCapability, key: string) {
  return findFieldCapability(widget, key)?.scope === 'style'
}

export function isKnownScope(value: unknown): value is FieldScope {
  return isScope(value)
}
