/**
 * Business tools can prepare data that a later edit tool consumes. The Agents
 * SDK starts function tools from one model response concurrently by default,
 * so a later tool may otherwise run before the context written by an earlier
 * tool is available. Keep tool execution ordered within each Agent Run.
 */
export const AGENT_TOOL_EXECUTION = Object.freeze({
  maxFunctionToolConcurrency: 1,
})
