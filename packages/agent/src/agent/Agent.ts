import { computed, ref } from "vue"
import type { ComputedRef, Ref } from "vue"
import { run } from "./core/run"
import type { RunEvent } from "./core/run"
import { createAgentTool } from "./core/agentTool"
import type { AgentAsToolOptions } from "./core/agentTool"
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
