import { computed, ref, shallowRef, ShallowRef, triggerRef } from "vue"
import type { ComputedRef, Ref } from "vue"
import { ThreadMessage } from "./type"
import { run } from "./core/run"
import type { RunEvent } from "./core/run"
import { createAgentTool } from "./core/agentTool"
import type { AgentAsToolOptions } from "./core/agentTool"
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
  /** 审批提示文案（来自工具的 `approval.message`） */
  message: string
}

/** 返回 true 表示用户同意执行，false 表示拒绝（拒绝后继续处理下一个） */
export type ToolApprovalHandler = (
  request: ToolApprovalRequest,
) => boolean | Promise<boolean>

/**
 * 工具级审批配置：和 `needsApproval` 一样写在 tool 上。
 * 业务侧只提供文案和同意 / 拒绝后的回调。
 */
export interface ToolApprovalOptions {
  /** 审批提示文案 */
  message?: (input: any) => string
  /** 用户同意后的回调 */
  onApprove?: (input: any) => void
  /** 用户拒绝后的回调 */
  onReject?: (input: any) => void
}

/**
 * 审批状态由 Agent 管理：UI 读 `agent.approval.pending` 展示，
 * 调用 `approve` / `reject` 给决定；文案与回调来自对应工具。
 */
export interface AgentApproval {
  /** 当前待确认的请求；没有则为 null */
  pending: Ref<ToolApprovalRequest | null>
  /** 当前请求的提示文案 */
  message: ComputedRef<string>
  /** 交给 Runner 的审批回调 */
  onApproval: ToolApprovalHandler
  /** 同意当前请求 */
  approve: () => boolean
  /** 拒绝当前请求 */
  reject: () => boolean
  /** 给出当前请求的决定 */
  resolve: (approved: boolean) => boolean
}

function createAgentApproval(): AgentApproval {
  const pending = ref<ToolApprovalRequest | null>(null)
  let resolver: ((approved: boolean) => void) | null = null

  // 文案来自工具的 approval.message（由 Runner 放进 request）
  const message = computed(() => pending.value?.message ?? '')

  const resolve = (approved: boolean): boolean => {
    const request = pending.value
    const done = resolver
    if (!request || !done) {
      return false
    }

    resolver = null
    pending.value = null
    done(approved)
    return true
  }

  const onApproval: ToolApprovalHandler = (request) => {
    // 理论上运行时是串行等待的；若真有请求叠加，先把上一个按拒绝收尾
    if (resolver) {
      resolve(false)
    }

    pending.value = request

    return new Promise<boolean>((done) => {
      resolver = done
    })
  }

  return {
    pending,
    message,
    onApproval,
    approve: () => resolve(true),
    reject: () => resolve(false),
    resolve,
  }
}

/** 工具执行时由 Runtime 注入的上下文，工具可据此把嵌套运行的钩子继续上抛 */
export interface ToolRunContext {
  onEvent?: (event: RunEvent) => void
  onApproval?: ToolApprovalHandler
}

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
  /** 审批文案与同意 / 拒绝回调，和 `needsApproval` 一样写在 tool 上 */
  approval?: ToolApprovalOptions
  invoke: (input: any, context?: ToolRunContext) => Promise<string | Result>
}

export type Tool<Context = unknown> = FunctionTool<Context, any, any>

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

  /** 审批状态由 Agent 自己管理 */
  public approval: AgentApproval

  public outputType: TOutput = 'text' as TOutput

  constructor(config: AgentOptions<TContext, TOutput>) {
    this.name = config.name
    this.instructions = config.instructions ?? ''
    this.handoffDescription = config.handoffDescription ?? ''
    this.tools = config.tools ?? []
    this.approval = createAgentApproval()

    if (config.outputType) {
      this.outputType = config.outputType
    }
  }

  /**
   * 把这个 Agent 包装成一个工具，交给上层「负责流程」的 Agent 使用。
   *
   * 上层模型会在自己的 tools 列表里看到这个子 Agent，
   * 并根据 `toolName` / `toolDescription` 自行决定何时调用它：
   *
   * ```ts
   * const flowAgent = new Agent({
   *   name: 'flow',
   *   instructions: '按需调用子 Agent',
   *   tools: [
   *     normalizeAgent.asTool({ toolName: 'normalize' }),
   *     layoutAgent.asTool({ toolName: 'layout' }),
   *   ],
   * })
   * ```
   */
  asTool(options: AgentAsToolOptions = {}): Tool<TContext> {
    return createAgentTool(this, options) as Tool<TContext>
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
布局目标：

在满足业务语义和组件使用约束的前提下，优先生成视觉上舒展、充分利用页面空间的布局。

布局决策必须按照以下顺序进行：

第一步：确定页面需要多少个 widget，以及每个 widget 应该承载哪些元素。

第二步：根据已经确定的元素分配方式，从运行时提供的组件中选择能够满足对应布局需求的组件。

第三步：将所选择组件原始的 typeId 写入 Layout IR。

不要先选择组件，再根据组件能够承载多少元素决定元素分组。

对于元素数量较少的情况：

默认将每个元素作为独立的布局单元，即默认一个元素对应一个 widget。

即使某个组件本身可以同时承载多个元素，也不能因此将多个元素自动合并到同一个 widget。

只有当合并能够带来明确的布局收益，并且符合整体页面布局目标时，才可以改变默认的“一元素一个 widget”分配方式。

少量元素进行布局时，应优先考虑：

* 每个元素独立展示；
* 增加单个元素的展示面积；
* 通过多个独立 widget 增加页面的视觉丰富度；
* 避免少量元素集中在一个区域。

因此，对于少量元素，“组件能否承载多个元素”只决定该组件是否具备合并能力，不决定是否应该合并。

对于元素数量较多的情况：

不再默认一个元素对应一个 widget。

此时应根据页面的信息密度进行分组，将适合集中展示的元素放入能够承载多个元素的组件，同时可以将少量需要突出展示的元素保留为独立 widget。

具体原则：

1. 少量元素优先考虑“大面积、低密度”的布局。
2. 元素数量越少，越应该提高单个元素的展示面积。
3. 不要为了减少 widget 数量而把多个元素强行放进同一个 widget。
4. 如果一个 widget 固定占一整行，而其设计目标是突出单个元素，那么少量元素应该优先“一元素一个 widget”。
5. 元素较多时，才考虑使用网格、列表等高密度组件，以提高页面的信息承载效率。
6. 在多个组件都满足业务需求时，优先选择能够提供更大视觉面积、更加舒展的方案。
7. 布局应该避免出现页面大量留白但元素本身过度拥挤的情况。

元素分组时，不得仅因为多个元素具有相同的 kind、属于同一业务类型或可以使用同一个组件，就将它们合并。

布局元素的数据都应该从原始数据中获取，不得自行编造。

布局目标：

在满足业务语义和组件使用约束的前提下，优先生成视觉上舒展、充分利用页面空间的布局。

对于元素数量较少的情况，应避免使用高密度组件将多个元素压缩在同一个区域。如果存在能够让单个元素获得更大展示面积的组件，应优先拆分元素，让每个元素获得独立的展示区域。

对于元素数量较多的情况，可以适当提高信息密度，将多个元素组织到同一个 widget 中，以提高页面的信息承载效率。

优先级：

1. 业务语义正确
2. 满足组件约束
3. 充分利用页面空间
4. 保持合理的信息密度

具体原则：

1. 少量元素优先考虑“大面积、低密度”的布局。
2. 元素数量越少，越应该提高单个元素的展示面积。
3. 不要为了减少 widget 数量而把多个元素强行放进同一个 widget。
4. 如果一个 widget 固定占一整行，而其设计目标是突出单个元素，那么少量元素应该优先“一元素一个 widget”。
5. 元素较多时，才考虑使用网格、列表等高密度组件，以提高页面的信息承载效率。
6. 在多个组件都满足业务需求时，优先选择能够提供更大视觉面积、更加舒展的方案。
7. 布局应该避免出现页面大量留白但元素本身过度拥挤的情况。

对于少量元素，应特别注意以下布局目标：

少量元素本身意味着页面的信息量较低，此时布局的主要目标不是减少 widget 数量，而是提高页面的视觉丰富度和空间利用率。

因此，当一个组件可以同时承载多个元素时，不应仅因为组件支持多元素就将这些元素合并。

如果将元素拆分到多个 widget 后，可以使元素获得更大的独立展示面积，并使页面空间得到更充分的利用，则应优先采用拆分方案。

元素数量越少，这种拆分倾向越强。

只有当合并多个元素能够产生更合理的页面结构、明显改善空间利用率，或者拆分会造成不合理的大面积空白时，才应考虑合并。

元素数量较多时，则逐渐提高信息密度，可以将多个元素放入同一个 widget。

也就是说，布局策略应随着元素数量变化：

少量元素 → 低密度、大面积、独立展示优先

大量元素 → 高密度、批量展示、信息承载优先

组件是否支持多个元素，只表示组件具备这种布局能力，并不意味着在所有元素数量下都应该使用这种能力。

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
