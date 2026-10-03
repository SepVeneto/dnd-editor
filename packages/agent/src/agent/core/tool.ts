import { FunctionTool, JsonObjectSchema } from "../Agent"

export function tool(options: any): FunctionTool {
  const { name, description, parameters, invoke } = options
  return {
    type: 'function',
    name,
    description,
    parameters: parameters.toJSONSchema(),
    invoke,
  }
}