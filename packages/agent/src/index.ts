import Copilot from './agent/Copilot.vue'

export * as z from 'zod'

export const MpdAgent = Copilot

export { Agent } from './agent/Agent'
export type {
  AgentApproval,
  AgentConfiguration,
  AgentOutputType,
  FunctionTool,
  JsonObjectSchema,
  JsonObjectSchemaNonStrict,
  JsonObjectSchemaStrict,
  JsonSchemaDefinitionEntry,
  Tool,
  ToolApprovalHandler,
  ToolApprovalOptions,
  ToolApprovalRequest,
  ToolInputParameters,
  ToolRunContext,
  UnknownContext,
  ZodObjectLike,
} from './agent/Agent'

export type { AgentAsToolOptions } from './agent/core/agentTool'
export { createAgentTool, toToolName } from './agent/core/agentTool'
export { tool } from './agent/core/tool'
export { run, Runner } from './agent/core/run'
export type { RunEvent, RunResult, ToolCallResult } from './agent/core/run'

// Capability
export type {
  Capability,
  CapabilityContext,
  CapabilityDefinition,
  CapabilitySchema,
} from './agent/capability'
export {
  capabilitySchemaToJsonSchema,
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
  UpdateComponentIR,
} from './agent/ir'
export { editIrSchema, layoutIrSchema } from './agent/ir'

// Agents
export type { FlowClassification, FlowType } from './agent/flowAgent'
export { createFlowAgent } from './agent/flowAgent'
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
