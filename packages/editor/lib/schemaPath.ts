import type { SchemaItem } from '@sepveneto/dnde-core/class'

type DataRecord = Record<string, any>

/** 按 schema 的点路径读取配置值，不修改原始数据。 */
export function getSchemaValue(data: DataRecord | undefined, key: string): any {
  if (!data)
    return undefined

  let current: any = data
  for (const part of key.split('.')) {
    if (current == null)
      return undefined
    current = current[part]
  }
  return current
}

/** 按 schema 的点路径写入配置值，缺失或类型冲突的中间节点会替换为对象。 */
export function setSchemaValue(data: DataRecord, key: string, value: unknown): void {
  const path = key.split('.')
  let current = data

  for (const part of path.slice(0, -1)) {
    const next = current[part]
    if (!next || typeof next !== 'object') {
      current[part] = {}
    }
    current = current[part]
  }

  current[path.at(-1)!] = value
}

/** 判断点路径上的值是否存在，保留显式写入的 null / undefined。 */
function hasSchemaValue(data: DataRecord, key: string): boolean {
  let current: any = data
  for (const part of key.split('.')) {
    if (current == null || !Object.prototype.hasOwnProperty.call(current, part))
      return false
    current = current[part]
  }
  return true
}

function cloneDefaultValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object')
    return value
  return JSON.parse(JSON.stringify(value))
}

/** 只补齐 schema 中配置了 defaultValue 且旧数据缺失的字段。 */
export function applySchemaDefaults(
  data: DataRecord,
  configs: SchemaItem[],
): DataRecord {
  for (const config of configs) {
    if (config.defaultValue !== undefined && !hasSchemaValue(data, config.key)) {
      setSchemaValue(data, config.key, cloneDefaultValue(config.defaultValue))
    }
    applySchemaDefaults(data, getLinkedSchemaItems(config, data))
  }
  return data
}

/** 根据当前配置值查找 select/radio/radioButton 的联动配置项。 */
export function getLinkedSchemaItems(config: SchemaItem, data: DataRecord): SchemaItem[] {
  if (config.type !== 'select' && config.type !== 'radio' && config.type !== 'radioButton')
    return []

  const value = getSchemaValue(data, config.key)
  return config.link?.[value] ?? []
}
