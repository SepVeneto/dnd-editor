import Copilot from './agent/Copilot.vue'
export  * as z from 'zod'

export const MpdAgent = Copilot

export { Agent } from './agent/Agent'
export type {
  AgentApproval,
  FunctionTool,
  Tool,
  ToolApprovalHandler,
  ToolApprovalOptions,
  ToolApprovalRequest,
  ToolRunContext,
} from './agent/Agent'
export type { AgentAsToolOptions } from './agent/core/agentTool'
export { createAgentTool, toToolName } from './agent/core/agentTool'
export type { DecorationFlow, DecorationFlowState } from './agent/flow'
export { createDecorationFlowAgent } from './agent/flow'
export {
  clearRegisteredAgents,
  getRegisteredAgentTools,
  listRegisteredAgents,
  registerAgent,
  unregisterAgent,
} from './agent/registry'
export { tool } from './agent/core/tool'
export { run } from './agent/core/run'
