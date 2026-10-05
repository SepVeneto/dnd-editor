import type { Agent, FunctionTool } from './Agent'
import type { AgentAsToolOptions } from './core/agentTool'
import { createAgentTool } from './core/agentTool'

/**
 * Agent Tool Registry。
 *
 * 外部能力（Producer / 宿主 / 插件）不需要知道流程 Agent 长什么样，
 * 只要把子 Agent 注册进来，流程 Agent 构建时就会自动把它当成 tool 暴露给模型：
 *
 * ```ts
 * registerAgent(couponAgent, {
 *   toolName: 'configure_coupon',
 *   toolDescription: '配置优惠券组件的标题、数据源与展示方式。',
 * })
 * ```
 *
 * 注册后返回对应的 `FunctionTool`；如果只是想手写进某个 Agent 的 `tools`，
 * 也可以直接用这个返回值。
 */
const agentToolRegistry = new Map<string, FunctionTool>()

/**
 * 注册一个 Agent，使其可以作为 tool 被流程 Agent 使用。
 * 同名会覆盖之前注册的工具。
 */
export function registerAgent(
  agent: Agent<any, any>,
  options: AgentAsToolOptions = {},
): FunctionTool {
  const tool = createAgentTool(agent, options)
  agentToolRegistry.set(tool.name, tool)
  return tool
}

/** 取消注册；返回是否真的移除了一个工具 */
export function unregisterAgent(name: string): boolean {
  return agentToolRegistry.delete(name)
}

/** 当前注册的所有工具名 */
export function listRegisteredAgents(): string[] {
  return [...agentToolRegistry.keys()]
}

/**
 * 取出已注册的 agent tool。
 * 传 `names` 时按给定顺序返回其中存在的工具，便于固定顺序 / 过滤。
 */
export function getRegisteredAgentTools(names?: string[]): FunctionTool[] {
  if (!names) {
    return [...agentToolRegistry.values()]
  }

  return names.flatMap((name) => {
    const tool = agentToolRegistry.get(name)
    return tool ? [tool] : []
  })
}

/** 清空注册表（测试或热更新时用） */
export function clearRegisteredAgents(): void {
  agentToolRegistry.clear()
}
