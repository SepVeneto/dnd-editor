import { getModel } from "../../element";
import { Agent, AgentConfiguration, AgentOutputType } from "@openai/agents";

type AgentOptions<TContext = unknown, TOutput extends AgentOutputType = "text"> =
  Omit<AgentConfiguration<TContext, TOutput>, 'model'>

export function createAgent<TContext = unknown, TOutput extends AgentOutputType = "text">(
  options: Partial<AgentOptions<TContext, TOutput>> & { name: string },
): Agent<TContext, TOutput> {
  return new Agent<TContext, TOutput>({
    ...options,
    model: getModel()
  })
}
