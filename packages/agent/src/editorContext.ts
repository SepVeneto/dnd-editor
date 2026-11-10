import type {
  AgentEditorOperation,
  EditorAgentContext,
} from './types'

/**
 * Create isolated editor/business state for one Agent Run.
 *
 * The host-provided context is copied into the Run Context and is only consumed
 * by tools through the SDK's normal passthrough.
 */
export function createEditorAgentContext(
  initial: Record<string, unknown> = {},
): EditorAgentContext {
  return { ...initial }
}

export interface PreparedEditorOperation {
  operation: AgentEditorOperation
  error?: string
}

/**
 * Remove any model-produced items. Add operations never read or inject hidden
 * context data; the host resolves the submitted operation when the tool runs.
 */
export function prepareEditorOperation(
  input: unknown,
  _context: EditorAgentContext,
): PreparedEditorOperation {
  const raw = input && typeof input === 'object'
    ? input as Record<string, unknown>
    : {}

  // Never forward an `items` value supplied by the model.
  const { items: _modelItems, ...operation } = raw as Record<string, unknown> & {
    items?: unknown
  }
  const prepared = operation as unknown as AgentEditorOperation

  // Model-authored changes are never a fill channel, including static config.
  delete prepared.changes

  if (prepared.action !== 'add')
    return { operation: prepared }

  // Add operations are always flat under the page root.
  delete prepared.target

  return { operation: prepared }
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

/** Compatibility hook. No Context data is consumed after an operation. */
export function completeEditorOperation(
  _context: EditorAgentContext,
  _prepared: PreparedEditorOperation,
  _result: unknown,
): void {}
