import type { SchemaItem } from './class'
import type { IWidget } from './types'

export type FieldScope = 'style' | 'content' | 'layout'

export type CapabilityValueType
  = | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'enum'
    | 'array'
    | 'object'
    | 'unknown'

export interface WidgetFieldCapability {
  source: 'prop'
  key: string
  label: string
  valueType: CapabilityValueType
  scope: FieldScope
  required: boolean
  readOnly: boolean
  enum?: unknown[]
  minimum?: number
  maximum?: number
  default?: unknown
}

export interface WidgetCustomCapability {
  name: string
  inputSchema?: Record<string, unknown>
  resourceTypes: string[]
  maxItems?: number
  semantics: 'append' | 'replace' | 'remove' | 'command'
  idempotent: boolean
  destructive: boolean
  writableScope: FieldScope
}

export interface WidgetCustomTypeCapability {
  type: string
  capabilities: WidgetCustomCapability[]
}

export interface StaticOption {
  id: string
  name: string
  aliases: string[]
  value: unknown
  types: string[]
}

export interface WidgetCapabilityRegistration {
  customTypes?: WidgetCustomTypeCapability[]
  staticOptions?: StaticOption[]
}

export type WidgetCapabilityRegistry = Record<string, WidgetCapabilityRegistration>

export interface WidgetCapability {
  type: string
  name: string
  description: string
  defaultData: Record<string, any>
  defaultStyle: Record<string, any>
  fields: WidgetFieldCapability[]
  customTypes: WidgetCustomTypeCapability[]
  staticOptions: StaticOption[]
}

export interface CapabilityCatalog {
  catalogVersion: '1.0'
  widgets: WidgetCapability[]
}

function optionValues(item: SchemaItem): unknown[] | undefined {
  if (!('options' in item) || !Array.isArray(item.options))
    return
  return (item.options as unknown[])
    .map((option: any) => option && typeof option === 'object' ? option.value : undefined)
    .filter((value: unknown) => value !== undefined)
}

function fieldFromSchema(item: SchemaItem, scope: FieldScope): WidgetFieldCapability | undefined {
  if (item.type === 'custom')
    return

  let valueType: CapabilityValueType = 'unknown'
  let enumValues: unknown[] | undefined
  let minimum: number | undefined
  let maximum: number | undefined

  switch (item.type) {
    case 'input':
    case 'colorPicker':
    case 'datetimePicker':
      valueType = 'string'
      break
    case 'number':
    case 'styleNumber':
      valueType = 'number'
      minimum = typeof (item as any).attrs?.min === 'number' ? (item as any).attrs.min : undefined
      maximum = typeof (item as any).attrs?.max === 'number' ? (item as any).attrs.max : undefined
      break
    case 'switch':
      if (
        'attrs' in item
        && item.attrs
        && (
          'activeValue' in item.attrs
          || 'inactiveValue' in item.attrs
        )
      ) {
        valueType = 'enum'
        enumValues = [
          (item.attrs as any).activeValue,
          (item.attrs as any).inactiveValue,
        ].filter(value => value !== undefined)
      }
      else {
        valueType = 'boolean'
      }
      break
    case 'checkbox':
      valueType = 'boolean'
      break
    case 'select':
    case 'radio':
    case 'radioButton':
      valueType = 'enum'
      enumValues = optionValues(item)
      break
  }

  const rules = Array.isArray(item.rules)
    ? item.rules
    : item.rules
      ? [item.rules]
      : []

  return {
    source: 'prop',
    key: item.key,
    label: item.label,
    valueType,
    scope: item.scope ?? scope,
    required: rules.some((rule: any) => rule.required === true),
    readOnly: item.readOnly === true,
    enum: enumValues,
    minimum,
    maximum,
  }
}

function registeredCustomTypes(
  registration?: WidgetCapabilityRegistration,
): WidgetCustomTypeCapability[] {
  return (registration?.customTypes ?? []).map(type => ({
    type: type.type,
    capabilities: type.capabilities.map(capability => ({
      ...capability,
      resourceTypes: [...capability.resourceTypes],
    })),
  }))
}

function schemaCustomTypes(widget: IWidget): string[] {
  return (widget.schema?.props ?? [])
    .filter(item => item.type === 'custom')
    .map(item => item.name)
}

/**
 * Convert live widget declarations into the stable catalog consumed by
 * initialization and DSL validation. Custom schema entries are advertised from
 * the schema itself; executable capabilities must be registered by the host.
 */
export function createCapabilityCatalog(
  widgets: IWidget[],
  registry: WidgetCapabilityRegistry = {},
): CapabilityCatalog {
  const catalog: CapabilityCatalog = {
    catalogVersion: '1.0',
    widgets: [],
  }

  for (const widget of widgets) {
    const registration = registry[widget._view]
    const declared = registeredCustomTypes(registration)
    const declaredMap = new Map(declared.map(type => [type.type, type]))
    const customTypes = schemaCustomTypes(widget).map((type) => {
      return declaredMap.get(type) ?? { type, capabilities: [] }
    })

    catalog.widgets.push({
      type: widget._view,
      name: widget._name,
      description: widget.agent?.description ?? widget.agent?.layout?.description ?? '',
      defaultData: JSON.parse(JSON.stringify(widget.data ?? {})),
      defaultStyle: JSON.parse(JSON.stringify(widget.style ?? {})),
      fields: [
        ...(widget.schema?.props ?? [])
          .map(item => fieldFromSchema(item, 'content'))
          .filter((item): item is WidgetFieldCapability => Boolean(item)),
        ...(widget.schema?.style ?? [])
          .map(item => fieldFromSchema(item, 'style'))
          .filter((item): item is WidgetFieldCapability => Boolean(item)),
      ],
      customTypes,
      staticOptions: (registration?.staticOptions ?? []).map(option => ({
        ...option,
        aliases: [...option.aliases],
        types: [...option.types],
      })),
    })
  }

  return catalog
}

export function findWidgetCapability(
  catalog: CapabilityCatalog,
  type: string,
): WidgetCapability | undefined {
  return catalog.widgets.find(widget => widget.type === type)
}

export function findFieldCapability(
  widget: WidgetCapability,
  key: string,
): WidgetFieldCapability | undefined {
  return widget.fields.find(field => field.key === key)
}

export function findCustomCapability(
  widget: WidgetCapability,
  type: string,
  name: string,
): WidgetCustomCapability | undefined {
  return widget.customTypes
    .find(item => item.type === type)
    ?.capabilities
    .find(capability => capability.name === name)
}

export function listStaticOptions(
  catalog: CapabilityCatalog,
  widgetTypes?: string[],
  types?: string[],
): StaticOption[] {
  const selected = widgetTypes?.length
    ? catalog.widgets.filter(widget => widgetTypes.includes(widget.type))
    : catalog.widgets

  return selected.flatMap(widget => widget.staticOptions)
    .filter(option => !types?.length || option.types.some(type => types.includes(type)))
}
