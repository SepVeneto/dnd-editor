import type { IWidget } from '../src/types'
import { describe, expect, it } from 'vitest'
import { createCapabilityCatalog, findCustomCapability, findFieldCapability } from '../src/capability'

const jgq: IWidget = {
  _name: '金刚区',
  _view: 'jgq',
  data: { isShow: 1, data: { list: [] } },
  schema: {
    props: [
      {
        type: 'switch',
        label: '是否显示',
        key: 'isShow',
        scope: 'content',
        attrs: { activeValue: 1, inactiveValue: 0 },
      },
      {
        type: 'custom',
        label: '',
        key: 'data',
        name: 'jgq',
      },
    ],
    style: [
      {
        type: 'number',
        label: '最小高度',
        key: 'minHeight',
      },
    ],
  },
}

const registry = {
  jgq: {
    customTypes: [
      {
        type: 'jgq',
        capabilities: [
          {
            name: 'entry.items.append',
            resourceTypes: ['app', 'coupon', 'link'],
            maxItems: 8,
            semantics: 'append' as const,
            idempotent: false,
            destructive: false,
            writableScope: 'content' as const,
          },
        ],
      },
    ],
  },
}

describe('capability catalog', () => {
  it('derives standard fields and excludes custom form data', () => {
    const catalog = createCapabilityCatalog([jgq], registry)
    const capability = catalog.widgets[0]

    expect(capability.fields).toHaveLength(2)
    expect(findFieldCapability(capability, 'isShow')).toMatchObject({
      valueType: 'enum',
      enum: [1, 0],
      scope: 'content',
    })
    expect(findFieldCapability(capability, 'minHeight')).toMatchObject({
      valueType: 'number',
      scope: 'style',
    })
    expect(findFieldCapability(capability, 'data')).toBeUndefined()
    expect('resourceSlots' in capability).toBe(false)
  })

  it('registers custom capabilities only when the host declares them', () => {
    const catalog = createCapabilityCatalog([jgq])
    const capability = catalog.widgets[0]

    expect(capability.customTypes).toEqual([{ type: 'jgq', capabilities: [] }])
    expect(findCustomCapability(capability, 'jgq', 'entry.items.append')).toBeUndefined()
  })
})
