import type {
  CapabilityCatalog,
  InitializationContext,
  InitializationIr,
  InitializationIrIssue,
} from '@sepveneto/dnde-core'
import type { AgentHostApi, EditorAgentContext } from './types'
import {
  createInitializationLocations,
  normalizeInitializationIr,
  validateInitializationIr,
} from '@sepveneto/dnde-core'

export type PrepareInitializationResult
  = | {
    ok: true
    ir: InitializationIr
    status: InitializationContext['status']
    queryTools: string[]
  }
  | {
    ok: false
    stage: 'ir'
    issues: InitializationIrIssue[]
  }
  | {
    ok: false
    stage: 'capability'
    issues: InitializationIrIssue[]
    ir: InitializationIr
  }

/**
 * Normalize initialization input and write the host-owned location records to
 * the current Agent Run context. Shared by the model-facing tool and debug
 * startup so both paths have identical validation and IDs.
 */
export async function initializeEditorContext(
  rawIr: unknown,
  context: EditorAgentContext,
  api: AgentHostApi,
): Promise<PrepareInitializationResult> {
  if (!api.editor?.getCapabilities || !api.editor.getCurrentEditor)
    throw new Error('宿主未提供配置清单所需的编辑器能力目录 API')

  const currentEditor = await api.editor.getCurrentEditor() as Record<string, any>
  const baseDocRevision = typeof currentEditor?.revision === 'number'
    ? currentEditor.revision
    : 0
  const normalized = normalizeInitializationIr(rawIr, {
    irRevision: 0,
    baseDocRevision,
  })
  if (normalized.issues.length) {
    return {
      ok: false,
      stage: 'ir',
      issues: normalized.issues,
    }
  }

  const catalog = await api.editor.getCapabilities() as CapabilityCatalog
  const validation = validateInitializationIr(normalized.ir, catalog)
  if (!validation.ok) {
    return {
      ok: false,
      stage: 'capability',
      issues: validation.issues,
      ir: normalized.ir,
    }
  }

  const requestId = globalThis.crypto?.randomUUID?.() ?? `init-${Date.now()}`
  const locations = createInitializationLocations(normalized.ir, catalog)
  const status = normalized.ir.resources.length
    ? 'pending_resources'
    : 'ready'
  context.initialization = {
    ir: normalized.ir,
    requestId,
    locations,
    status,
    conflicts: [],
    unresolved: [],
    ignored: [],
  }

  return {
    ok: true,
    ir: normalized.ir,
    status,
    queryTools: [...new Set(
      normalized.ir.resources.map(resource => `query_${resource.type}_resources`),
    )],
  }
}
