import type { FunctionTool } from '@openai/agents'
import type { Capability } from './capability'
import { createCapabilityTool } from './capability'

/**
 * Capability Registry。
 *
 * 业务侧只注册 Capability，平台把它统一管理，并可按需包装成 Agent Tool
 * 供 Flow Agent / Edit Agent / Capability Agent 使用。
 */
const capabilityRegistry = new Map<string, Capability>()

/** 注册业务能力，并返回对应的 Agent Tool（同名覆盖）。 */
export function registerCapability(capability: Capability): FunctionTool {
  const tool = createCapabilityTool(capability)
  capabilityRegistry.set(capability.name, capability)
  return tool
}

/** 取消注册；返回是否真的移除了一个能力。 */
export function unregisterCapability(name: string): boolean {
  return capabilityRegistry.delete(name)
}

/** 当前注册的能力名列表。 */
export function listCapabilities(): string[] {
  return [...capabilityRegistry.keys()]
}

/** 取出已注册能力；传 `names` 时按给定顺序返回其中存在的能力。 */
export function getRegisteredCapabilities(names?: string[]): Capability[] {
  if (!names) {
    return [...capabilityRegistry.values()]
  }

  return names.flatMap((name) => {
    const capability = capabilityRegistry.get(name)
    return capability ? [capability] : []
  })
}

/** 把已注册能力统一包装成 Agent Tool。 */
export function getRegisteredCapabilityTools(names?: string[]): FunctionTool[] {
  return getRegisteredCapabilities(names).map(createCapabilityTool)
}

/** 清空注册表（测试或热更新时用）。 */
export function clearCapabilities(): void {
  capabilityRegistry.clear()
}
