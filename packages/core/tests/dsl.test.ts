import { describe, expect, it } from 'vitest'
import { validateEditorDsl } from '../src/dsl'

const catalog = {
  catalogVersion: '1.0' as const,
  widgets: [{
    type: 'jgq',
    name: '金刚区',
    description: '',
    defaultData: { isShow: 1 },
    defaultStyle: {},
    fields: [{
      source: 'prop' as const,
      key: 'isShow',
      label: '是否显示',
      valueType: 'enum' as const,
      enum: [1, 0],
      scope: 'content' as const,
      required: false,
      readOnly: false,
    }],
    customTypes: [{
      type: 'jgq',
      capabilities: [{
        name: 'entry.items.append',
        semantics: 'append' as const,
        idempotent: false,
        destructive: false,
        writableScope: 'content' as const,
      }],
    }],
    staticOptions: [],
  }],
}

const snapshot = {
  revision: 3,
  nodes: [{ uuid: 'root', type: 'page' }],
}

function validDsl() {
  return {
    dslVersion: '1.1',
    baseRevision: 3,
    scope: { mode: 'content_only', targets: [] },
    operations: [{
      op: 'add',
      key: 'entry-grid',
      widget: 'jgq',
      props: { isShow: 1 },
      custom: [{
        type: 'jgq',
        capability: 'entry.items.append',
        args: {
          value: 1,
        },
      }],
    }],
  }
}

describe('editor DSL validation', () => {
  it('accepts registered props and custom capabilities', () => {
    const result = validateEditorDsl(validDsl(), { catalog, snapshot })

    expect(result.ok).toBe(true)
    expect(result.normalized?.operations[0]).toMatchObject({
      op: 'add',
      key: 'entry-grid',
      widget: 'jgq',
    })
  })

  it('rejects unknown props', () => {
    const dsl = validDsl()
    dsl.operations[0].props = { title: '伪造字段' }
    const result = validateEditorDsl(dsl, { catalog, snapshot })

    expect(result.ok).toBe(false)
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['unknown_prop']),
    )
  })

  it('rejects content writes under style-only scope', () => {
    const dsl = validDsl()
    dsl.scope.mode = 'style_only'
    const result = validateEditorDsl(dsl, { catalog, snapshot })

    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining(['scope_violation', 'scope_violation']),
    )
  })

  it('rejects stale revisions before execution', () => {
    const dsl = validDsl()
    dsl.baseRevision = 2
    const result = validateEditorDsl(dsl, { catalog, snapshot })

    expect(result.issues.map(issue => issue.code)).toContain('stale_revision')
  })

  it('requires confirmation tokens for deletion', () => {
    const result = validateEditorDsl({
      dslVersion: '1.1',
      baseRevision: 3,
      scope: { mode: 'any', targets: [] },
      operations: [{ op: 'delete', uuid: 'root' }],
    }, { catalog, snapshot })

    expect(result.issues.map(issue => issue.code)).toContain('delete_confirmation_required')
  })
})
