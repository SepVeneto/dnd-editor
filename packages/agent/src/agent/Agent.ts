import { ref, shallowRef, ShallowRef, triggerRef } from "vue"
import { ThreadMessage } from "./type"
import { run } from "./core/run"
import { ZodObject } from "zod";
import { z } from 'zod'

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

/** 运行时准备执行需要确认的工具时，抛给宿主的审批请求 */
export type ToolApprovalRequest = {
  callId: string
  name: string
  args: unknown
}

/** 返回 true 表示用户同意执行，false 表示拒绝（拒绝后继续处理下一个） */
export type ToolApprovalHandler = (
  request: ToolApprovalRequest,
) => boolean | Promise<boolean>

export type FunctionTool<
  Context = UnknownContext,
  TParameters extends ToolInputParameters = undefined,
  Result = unknown
> = {
  type: 'function',
  name: string
  description: string
  parameters: JsonObjectSchema<any>
  /**
   * 是否需要人工确认后才执行：
   * - true / false：固定策略
   * - 函数：根据本次入参动态判断
   */
  needsApproval?: boolean | ((input: any) => boolean | Promise<boolean>)
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

export const normalizeLayoutInputAgent = new Agent({
  name: 'normalize layout input',
  instructions: `将输入的业务内容标准化
  输入对象的每一个顶层字段都是一个业务类型，例如 scenes、coupon。
每个顶层字段对应输出中的一个 kind。
  `,
  outputType: z.array(z.object({
    kind: z.string().describe('输入数据的顶层字段名'),
    items: z.array(z.object({
      name: z.string().describe('原始业务数据中的 name'),
      id: z.number().nullable().describe('原始业务数据中的 id'),
    }))
  }))
})

export const layoutAgent = new Agent({
  name: 'layout generator',
  instructions: `
你是一个 H5 DIY 页面布局生成 Agent。

你的任务是根据：

用户需要展示的元素
运行时提供的组件说明
业务数据

自主决定如何将元素组织成页面布局，并生成 Layout IR。

重要约束：

运行时提供的组件说明中可能包含 typeId。typeId 仅用于最终 Layout IR 中标识所选择的组件，不得参与布局决策。

在进行布局分析、组件选择、元素分组时，必须完全忽略 typeId 的内容，不得根据 typeId 的名称、缩写、字符特征或任何可推测出的语义判断组件用途或布局能力。

组件的用途、布局能力和适用场景，只能依据运行时提供的 description、layout 以及其他明确声明的能力和约束进行判断。

也就是说，应将每个组件视为一个匿名的布局能力集合。先根据业务元素确定需要的布局方式，再根据组件说明选择满足该布局方式的组件，最后仅将被选择组件原始的 typeId 写入 Layout IR。

布局目标：

在满足业务语义和组件使用约束的前提下，优先生成视觉上舒展、充分利用页面空间的布局。

对于元素数量较少的情况，应避免使用高密度组件将多个元素压缩在同一个区域。如果存在能够让单个元素获得更大展示面积的组件，应优先拆分元素，让每个元素获得独立的展示区域。

优先级：

业务语义正确
满足组件约束
充分利用页面空间
保持合理的信息密度

具体原则：

少量元素优先考虑“大面积、低密度”的布局。
元素数量越少，越应该提高单个元素的展示面积。
不要为了减少 widget 数量而把多个元素强行放进同一个 widget。
如果一个 widget 固定占一整行，而其设计目标是突出单个元素，那么少量元素应该优先“一元素一个 widget”。
元素较多时，才考虑使用网格、列表等高密度组件，以提高页面的信息承载效率。
在多个组件都满足业务需求时，优先选择能够提供更大视觉面积、更加舒展的方案。
布局应该避免出现页面大量留白但元素本身过度拥挤的情况。

布局元素的数据都应该从原始数据中获取，不得自行编造。
  `,
  outputType: z.array(z.object({
    widget: z.string().describe('组件类型'),
    items: z.array(z.object({
      category: z.string().describe('元素分类'),
      id: z.any().describe('元素索引')
    }))
  }))
})

export const layoutEditorAgent = new Agent({
  name: 'layout editor',
  instructions: '布局编辑器',
})
