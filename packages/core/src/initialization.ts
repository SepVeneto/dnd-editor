import type { CapabilityCatalog } from './capability'
import { findWidgetCapability } from './capability'

export const IR_RESOURCE_TYPES = ['link', 'app', 'coupon'] as const

export type IrResourceType = typeof IR_RESOURCE_TYPES[number]

export interface IrResource {
  /** Host-generated location that owns this resource declaration. */
  locationId: string
  /** Component key that owns this resource declaration. */
  component: string
  /** Closed enum; model-invented types are rejected. */
  type: IrResourceType
  required: boolean
  query: string
}

export interface IrComponent {
  /** Host-generated identity for this component position. */
  locationId: string
  key: string
  type: string
  required: boolean
}

export interface InitializationLocationContext {
  locationId: string
  componentKey: string
  widget: string
  /** Standard props known before or supplied while adding the component. */
  standardProps: Record<string, unknown>
  /** Host-owned resource results grouped by resource type. */
  resources: Record<string, unknown[]>
}

export interface InitializationContext {
  ir: InitializationIr
  requestId: string
  locations: Record<string, InitializationLocationContext>
  status: 'pending_resources' | 'ready' | 'hold' | 'unresolved'
  conflicts: unknown[]
  unresolved: unknown[]
  ignored: unknown[]
}

export interface InitializationIr {
  irVersion: '1.4'
  irRevision: number
  baseDocRevision: number
  intent: string
  /** Array order is the page component order; IR has no placement fields. */
  components: IrComponent[]
  resources: IrResource[]
}

export interface InitializationIrIssue {
  code: string
  path: string
  message: string
}

export interface NormalizeInitializationIrOptions {
  irRevision?: number
  baseDocRevision?: number
  /** Override location ID creation in deterministic host/test environments. */
  createLocationId?: () => string
}

export interface NormalizeInitializationIrResult {
  ir: InitializationIr
  issues: InitializationIrIssue[]
}

interface IrResourceDraft {
  locationId: string
  component: string
  type: IrResourceType
  required: boolean
  query: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, '').toLocaleLowerCase()
}

function isResourceType(value: string): value is IrResourceType {
  return (IR_RESOURCE_TYPES as readonly string[]).includes(value)
}

function normalizeComponents(
  value: unknown,
  createLocationId: () => string,
) {
  if (!Array.isArray(value))
    return []

  return value.flatMap((item): IrComponent[] => {
    const component = asRecord(item)
    const key = asString(component.key)
    const type = asString(component.type)
    if (!key || !type)
      return []

    return [{
      locationId: createLocationId(),
      key,
      type,
      required: true,
    }]
  })
}

function normalizeResourceDraft(
  item: unknown,
  index: number,
  locationIds: Map<string, string>,
  issues: InitializationIrIssue[],
): IrResourceDraft | undefined {
  const resource = asRecord(item)
  const component = asString(resource.component)
  const type = asString(resource.type)
  const query = asString(resource.query)

  if (!component) {
    issues.push({
      code: 'missing_resource_component',
      path: `resources[${index}].component`,
      message: '资源必须归属于一个 IR 组件',
    })
  }
  if (!isResourceType(type)) {
    issues.push({
      code: 'invalid_resource_type',
      path: `resources[${index}].type`,
      message: `资源类型必须是 ${IR_RESOURCE_TYPES.join('/')} 之一`,
    })
  }
  if (typeof resource.required !== 'boolean') {
    issues.push({
      code: 'invalid_resource_required',
      path: `resources[${index}].required`,
      message: '资源必须明确标记 required 为布尔值',
    })
  }
  if (!query) {
    issues.push({
      code: 'missing_resource_query',
      path: `resources[${index}].query`,
      message: '资源必须提供严格匹配使用的查询文本',
    })
  }

  if (!component || !isResourceType(type) || !query)
    return

  return {
    locationId: locationIds.get(component) ?? '',
    component,
    type,
    required: resource.required === true,
    query,
  }
}

function normalizeResources(
  value: unknown,
  locationIds: Map<string, string>,
  issues: InitializationIrIssue[],
) {
  if (!Array.isArray(value))
    return []

  const canonical = new Map<string, IrResourceDraft>()
  value.forEach((item, index) => {
    const resource = normalizeResourceDraft(item, index, locationIds, issues)
    if (!resource)
      return

    const key = `${resource.locationId}:${resource.type}:${normalizeText(resource.query)}`
    const existing = canonical.get(key)
    if (existing) {
      existing.required ||= resource.required
      return
    }
    canonical.set(key, resource)
  })

  return [...canonical.values()]
}

/**
 * Normalize model-authored IR. The model only supplies component ownership,
 * the closed resource type enum, required boolean and query text. Query results
 * are owned by the host.
 */
export function normalizeInitializationIr(
  input: unknown,
  options: NormalizeInitializationIrOptions = {},
): NormalizeInitializationIrResult {
  const raw = asRecord(input)
  const issues: InitializationIrIssue[] = []
  const usedLocationIds = new Set<string>()
  const createLocationId = () => {
    let attempt = 0
    let locationId = ''
    do {
      const generated = options.createLocationId?.()
        ?? `loc-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
      locationId = attempt === 0 ? generated : `${generated}-${attempt + 1}`
      attempt += 1
    } while (!locationId || usedLocationIds.has(locationId))
    usedLocationIds.add(locationId)
    return locationId
  }
  const components = normalizeComponents(raw.components, createLocationId)
  const locationIds = new Map(
    components.map(component => [component.key, component.locationId]),
  )
  const resources = normalizeResources(raw.resources, locationIds, issues)
  const ir: InitializationIr = {
    irVersion: '1.4',
    irRevision: options.irRevision ?? 0,
    baseDocRevision: options.baseDocRevision ?? 0,
    intent: asString(raw.intent),
    components,
    resources,
  }

  issues.push(...validateInitializationIrShape(ir).issues)
  return { ir, issues }
}

function validateInitializationIrShape(ir: InitializationIr) {
  const issues: InitializationIrIssue[] = []
  const componentKeys = new Set<string>()
  const locationIds = new Set<string>()

  if (!ir.intent) {
    issues.push({
      code: 'missing_intent',
      path: 'intent',
      message: 'IR 必须提供 intent',
    })
  }
  if (!ir.components.length) {
    issues.push({
      code: 'missing_components',
      path: 'components',
      message: 'IR 至少需要一个组件',
    })
  }

  ir.components.forEach((component, index) => {
    if (componentKeys.has(component.key)) {
      issues.push({
        code: 'duplicate_component_key',
        path: `components[${index}].key`,
        message: `组件 key 重复：${component.key}`,
      })
    }
    componentKeys.add(component.key)
    if (!component.locationId) {
      issues.push({
        code: 'missing_location_id',
        path: `components[${index}].locationId`,
        message: 'IR 组件必须包含宿主生成的位置 ID',
      })
    }
    else if (locationIds.has(component.locationId)) {
      issues.push({
        code: 'duplicate_location_id',
        path: `components[${index}].locationId`,
        message: `位置 ID 重复：${component.locationId}`,
      })
    }
    locationIds.add(component.locationId)
  })

  ir.resources.forEach((resource, index) => {
    if (!componentKeys.has(resource.component)) {
      issues.push({
        code: 'unknown_resource_component',
        path: `resources[${index}].component`,
        message: `资源归属的组件不存在：${resource.component}`,
      })
    }
  })

  return { issues }
}

export function validateInitializationIr(
  ir: InitializationIr,
  catalog: CapabilityCatalog,
) {
  const { issues } = validateInitializationIrShape(ir)

  ir.components.forEach((component, index) => {
    const capability = findWidgetCapability(catalog, component.type)
    if (!capability) {
      issues.push({
        code: 'unknown_widget',
        path: `components[${index}].type`,
        message: `组件能力目录中不存在 ${component.type}`,
      })
    }
  })

  return {
    ok: issues.length === 0,
    issues,
  }
}

function readPath(target: Record<string, unknown>, path: string) {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current))
      return undefined
    return (current as Record<string, unknown>)[key]
  }, target)
}

/**
 * Build the host-owned location records referenced by host-generated IR IDs.
 * Standard props start from widget defaults; resources are filled by the
 * business host's query tools.
 */
export function createInitializationLocations(
  ir: InitializationIr,
  catalog: CapabilityCatalog,
): Record<string, InitializationLocationContext> {
  return Object.fromEntries(
    ir.components.map((component) => {
      const widget = findWidgetCapability(catalog, component.type)
      const standardProps = Object.fromEntries(
        (widget?.fields ?? []).flatMap((field) => {
          const value = readPath(widget?.defaultData ?? {}, field.key)
          return value === undefined ? [] : [[field.key, value]]
        }),
      )
      return [component.locationId, {
        locationId: component.locationId,
        componentKey: component.key,
        widget: component.type,
        standardProps,
        resources: {},
      }]
    }),
  )
}

/**
 * Merge model-supplied standard props into the IR location before the host
 * update callback runs. The returned location is the same mutable record that
 * resource tools populate.
 */
export function mergeInitializationLocationProps(
  context: { initialization?: InitializationContext },
  locationId: string,
  props: Record<string, unknown>,
): InitializationLocationContext | undefined {
  const location = context.initialization?.locations?.[locationId]
  if (!location)
    return
  location.standardProps = {
    ...location.standardProps,
    ...props,
  }
  return location
}
