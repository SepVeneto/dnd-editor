import Copilot from './agent/Copilot.vue'

export const MpdAgent = Copilot

// Agent Loop / Tool Calling / Session / Context：由 OpenAI Agents SDK 提供。
export {
  Agent,
  MemorySession,
  Runner,
  run,
  tool,
} from '@openai/agents'

export type {
  FunctionTool,
  RunContext,
  RunResult,
  Session,
  Tool,
} from '@openai/agents'

// 模型接口调用：走原来的 chat.completions（服务器代理），并作为 SDK 的 Model 适配器接入。
export {
  configureModel,
  getModel,
  getModelConfig,
  getModelName,
  runAgent,
  runAgentStreamed,
  setMockClient,
} from './agent/core/sdk'
export type { ModelConfig, RunAgentOptions } from './agent/core/sdk'

// 平台上下文。
export type {
  AppContext,
  ToolApprovalHandler,
  ToolApprovalRequest,
} from './agent/context'

// Capability
export type {
  Capability,
  CapabilityContext,
  CapabilityDefinition,
  CapabilitySchema,
  ToolApprovalOptions,
} from './agent/capability'
export {
  createCapabilityTool,
  defineCapability,
  invokeCapability,
} from './agent/capability'
export {
  clearCapabilities,
  getRegisteredCapabilities,
  getRegisteredCapabilityTools,
  listCapabilities,
  registerCapability,
  unregisterCapability,
} from './agent/capabilityRegistry'

// Workflow
export type {
  StepResult,
  Workflow,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowEvent,
  WorkflowRunOptions,
  WorkflowRunResult,
  WorkflowStatus,
  WorkflowStep,
} from './agent/workflow'
export { defineWorkflow, WorkflowRuntime } from './agent/workflow'

// IR
export type {
  AddComponentIR,
  DeleteComponentIR,
  EditIR,
  LayoutIR,
  LayoutWidgetItem,
  MoveComponentIR,
  NormalizedElement,
  NormalizedElementItem,
  NormalizedElements,
  UpdateComponentIR,
} from './agent/ir'
export { editIrSchema, layoutIrSchema } from './agent/ir'

// Agents
export type { FlowClassification, FlowType } from './agent/flowAgent'
export { createFlowAgent, flowOutputSchema } from './agent/flowAgent'
export { createEditAgent } from './agent/editAgent'
export { createCapabilityAgent } from './agent/capabilityAgent'
export type { LayoutWidgetDescriptor } from './agent/layout'
export { createLayoutAgent, generateLayoutIR } from './agent/layout'

// Runtime
export type {
  AgentRuntimeEvent,
  AgentRuntimeHooks,
  AgentRuntimeOptions,
  AgentRuntimeResult,
} from './agent/runtime'
export { AgentRuntime, createAgentRuntime } from './agent/runtime'

// Extraction helper
export type { StructuredExtractOptions } from './agent/extract'
export { parseJson, structuredExtract } from './agent/extract'

export * from './agent/utils/helper'
