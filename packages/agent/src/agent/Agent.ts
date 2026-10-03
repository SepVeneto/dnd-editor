import { ref, shallowRef, ShallowRef, triggerRef } from "vue"
import { ThreadMessage } from "./type"
import { run } from "./core/run"
import { ZodObject } from "zod";

export type JsonSchemaDefinitionEntry = Record<string, any>;

export type JsonObjectSchemaStrict<
  Properties extends Record<string, JsonSchemaDefinitionEntry>,
> = {
  type: 'object';
  properties: Properties;
  required: (keyof Properties)[];
  additionalProperties: false;
  description?: string;
};

export type JsonObjectSchemaNonStrict<
  Properties extends Record<string, JsonSchemaDefinitionEntry>,
> = {
  type: 'object';
  properties: Properties;
  required: (keyof Properties)[];
  additionalProperties: true;
  description?: string;
};

export type JsonObjectSchema<
  Properties extends Record<string, JsonSchemaDefinitionEntry>,
> = JsonObjectSchemaStrict<Properties> | JsonObjectSchemaNonStrict<Properties>;

export type UnknownContext = unknown;

export type ToolInputParameters =
  | undefined
  | JsonObjectSchema<any>

export type FunctionTool<
  Context = UnknownContext,
  TParameters extends ToolInputParameters = undefined,
  Result = unknown
> = {
  type: 'function',
  name: string
  description: string
  parameters: JsonObjectSchema<any>
  invoke: (input: any) => Promise<string | Result>
}

type Tool<Context = unknown> = FunctionTool<Context, any, any>

type TextOutput = 'text'

export type ZodObjectLike = ZodObject<any, any>;

export type AgentOutputType =
  | JsonSchemaDefinitionEntry
  | TextOutput
  | ZodObjectLike

export interface AgentConfiguration<
  TContext = UnknownContext,
  TOutput extends AgentOutputType = TextOutput
> {
  name: string
  instructions: string
  handoffDescription: string
  tools: Tool<TContext>[]
  outputType: TOutput
}

type AgentOptions<
  TContext = UnknownContext,
  TOutput extends AgentOutputType = TextOutput
> = Pick<AgentConfiguration<TContext, TOutput>, 'name'> & Partial<AgentConfiguration<TContext, TOutput>>
export class Agent<
  TContext = UnknownContext,
  TOutput extends AgentOutputType = TextOutput,
> implements AgentConfiguration<TContext, TOutput> {
  public name: string
  public instructions: string
  public handoffDescription: string
  public tools: Tool<TContext>[]

  public outputType: TOutput = 'text' as TOutput

  constructor(config: AgentOptions<TContext, TOutput>) {
    this.name = config.name
    this.instructions = config.instructions ?? ''
    this.handoffDescription = config.handoffDescription ?? ''
    this.tools = config.tools ?? []

    if (config.outputType) {
      this.outputType = config.outputType
    }
  }
}



function createId(): string {
  return Math.random().toString(36).slice(2, 10)
}
