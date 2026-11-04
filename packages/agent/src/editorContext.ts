import type {
  AgentEditorOperation,
  EditorAgentContext,
} from './types'

/**
 * Create isolated editor/business state for one Agent Run.
 *
 * Host context is copied in as read-only starting data. `pendingItems` is
 * always reset so data prepared by a previous turn cannot leak into this one.
 */
export function createEditorAgentContext(
  initial: Record<string, unknown> = {},
): EditorAgentContext {
  return {
    ...initial,
    pendingItems: [],
  }
}

export interface PreparedEditorOperation {
  operation: AgentEditorOperation
  /** Items reserved for this add operation; cleared only after success. */
  pendingItems?: unknown[]
  error?: string
}

/**
 * Remove any model-produced items and, for add operations, inject the data
 * prepared by a business tool for this run.
 */
export function prepareEditorOperation(
  input: unknown,
  context: EditorAgentContext,
): PreparedEditorOperation {
  const raw = input && typeof input === 'object'
    ? input as Record<string, unknown>
    : {}

  // Never forward an `items` value supplied by the model.
  const { items: _modelItems, ...operation } = raw as Record<string, unknown> & {
    items?: unknown
  }
  const prepared = operation as unknown as AgentEditorOperation

  // Layout is always flat: adding a widget never targets a nested parent.
  if (prepared.action === 'add')
    delete prepared.target

  if (prepared.action !== 'add')
    return { operation: prepared }

  const pendingItems = context.pendingItems
  if (!Array.isArray(pendingItems) || pendingItems.length === 0) {
    return {
      operation: prepared,
      error: '缺少待添加的业务数据，请先调用业务工具准备 items',
    }
  }

  return {
    operation: {
      ...prepared,
      items: pendingItems.slice(),
    },
    pendingItems,
  }
}

export function editorOperationSucceeded(result: unknown): boolean {
  return !(
    result
    && typeof result === 'object'
    && (
      (result as { ok?: unknown }).ok === false
      || 'error' in result
    )
  )
}

/**
 * Consume pending items only after the editor confirms success. A failed
 * operation keeps them available for a corrected retry in the same Run.
 */
export function completeEditorOperation(
  context: EditorAgentContext,
  prepared: PreparedEditorOperation,
  result: unknown,
): void {
  if (prepared.pendingItems && editorOperationSucceeded(result))
    context.pendingItems = []
}
