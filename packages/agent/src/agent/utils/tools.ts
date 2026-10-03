import { AgentOutputType, JsonObjectSchema, JsonSchemaDefinitionEntry, ZodObjectLike } from "../Agent";

export type JsonSchemaDefinition = {
  type: 'json_schema';
  name: string;
  strict: boolean;
  schema: JsonObjectSchema<Record<string, JsonSchemaDefinitionEntry>>;
};

type MinimalParseableTextFormat = {
  type: 'json_schema';
  name: string;
  strict?: boolean;
  schema: unknown;
};

type ZodDefinition = Record<string, unknown> | undefined;
type ZodLike = {
  _def?: Record<string, unknown>;
  def?: Record<string, unknown>;
  _zod?: { def?: Record<string, unknown> };
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
};


export function convertAgentOutputTypeToSerializable(outputType: AgentOutputType) {
  if (outputType === 'text') {
    return 'text'
  }

  if (isZodObject(outputType)) {
    const useFallback = (
      existing?: MinimalParseableTextFormat,
      originalError?: unknown,
    ): JsonSchemaDefinition => {

    }

    // let output: MinimalParseableTextFormat
    // try {
    // } catch (e) {
    //   return useFallback(undefined, e)
    // }

    // return useFallback(output)
  }
}

export function isZodObject(input: unknown): input is ZodObjectLike {
  const definition = readZodDefinition(input);
  if (!definition) {
    return false;
  }

  const type = readZodType(input);
  return type === 'object';
}

export function readZodDefinition(input: unknown): ZodDefinition {
  if (typeof input !== 'object' || input === null) {
    return undefined;
  }

  const candidate = input as ZodLike;
  return candidate._zod?.def || candidate._def || candidate.def;
}

export function readZodType(input: unknown): string | undefined {
  const def = readZodDefinition(input);
  if (!def) {
    return undefined;
  }

  const rawType =
    (typeof def.typeName === 'string' && def.typeName) ||
    (typeof def.type === 'string' && def.type);

  if (typeof rawType !== 'string') {
    return undefined;
  }

  const lower = rawType.toLowerCase();
  return lower.startsWith('zod') ? lower.slice(3) : lower;
}
