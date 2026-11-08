import { describe, expect, it } from 'vitest'
import {
  createInitializationLocations,
  mergeInitializationLocationProps,
  normalizeInitializationIr,
  validateInitializationIr,
} from '../src/initialization'

const catalog = {
  catalogVersion: '1.0' as const,
  widgets: [
    {
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
        scope: 'content' as const,
        required: false,
        readOnly: false,
      }],
      customTypes: [],
      staticOptions: [],
    },
    {
      type: 'shopPickup',
      name: '扫码提货',
      description: '',
      defaultData: {},
      defaultStyle: {},
      fields: [],
      customTypes: [],
      staticOptions: [],
    },
  ],
}

describe('initialization IR', () => {
  it('keeps only component ownership, enum type, required and query for resources', () => {
    const { ir, issues } = normalizeInitializationIr({
      intent: '配置首页金刚区',
      components: [
        {
          key: 'entry-grid',
          type: 'jgq',
          required: false,
          locationId: 'model-forged-location',
          resources: ['model-generated-reference'],
        },
      ],
      resources: [
        {
          locationId: 'model-forged-location',
          id: 'model-generated-id',
          component: 'entry-grid',
          type: 'app',
          required: true,
          query: '叮咚买菜',
          sources: [{ origin: 'config_list', ref: '清单第1项' }],
          hint: { staticCandidate: 'route.pickup' },
          classification: { type: 'link' },
          resolution: { status: 'resolved' },
        },
      ],
    }, {
      irRevision: 2,
      baseDocRevision: 12,
      createLocationId: () => 'location-entry-grid',
    })

    expect(issues).toEqual([])
    expect(ir).toEqual({
      irVersion: '1.4',
      irRevision: 2,
      baseDocRevision: 12,
      intent: '配置首页金刚区',
      components: [{
        locationId: 'location-entry-grid',
        key: 'entry-grid',
        type: 'jgq',
        required: true,
      }],
      resources: [{
        locationId: 'location-entry-grid',
        component: 'entry-grid',
        type: 'app',
        required: true,
        query: '叮咚买菜',
      }],
    })
  })

  it('preserves optional resources as boolean required=false', () => {
    const { ir } = normalizeInitializationIr({
      intent: '配置可选入口',
      components: [{ key: 'grid', type: 'jgq' }],
      resources: [{
        component: 'grid',
        type: 'coupon',
        required: false,
        query: '盒马鲜生',
      }],
    }, { createLocationId: () => 'location-grid' })

    expect(ir.resources[0]).toMatchObject({
      locationId: 'location-grid',
      type: 'coupon',
      required: false,
    })
  })

  it('merges repeated coupon-brand queries in the same component slot', () => {
    const { ir } = normalizeInitializationIr({
      intent: '配置卡券品牌',
      components: [{ key: 'entry-grid', type: 'jgq' }],
      resources: [
        {
          component: 'entry-grid',
          type: 'coupon',
          required: false,
          query: '盒马鲜生',
        },
        {
          component: 'entry-grid',
          type: 'coupon',
          required: true,
          query: '盒马 鲜生',
        },
      ],
    }, { createLocationId: () => 'location-entry-grid' })

    expect(ir.resources).toEqual([{
      locationId: 'location-entry-grid',
      component: 'entry-grid',
      type: 'coupon',
      required: true,
      query: '盒马鲜生',
    }])
  })

  it('rejects model-invented resource types without coercing them', () => {
    const { ir, issues } = normalizeInitializationIr({
      intent: '配置资源',
      components: [{ key: 'entry-grid', type: 'jgq' }],
      resources: [{
        component: 'entry-grid',
        type: 'scene',
        required: true,
        query: '叮咚买菜',
      }],
    })

    expect(ir.resources).toEqual([])
    expect(issues.map(issue => issue.code)).toContain('invalid_resource_type')
  })

  it('generates distinct location IDs for repeated widgets', () => {
    let nextId = 0
    const { ir, issues } = normalizeInitializationIr({
      intent: '配置两个金刚区',
      components: [
        { key: 'top-grid', type: 'jgq' },
        { key: 'bottom-grid', type: 'jgq' },
      ],
      resources: [
        {
          component: 'top-grid',
          type: 'app',
          required: true,
          query: '叮咚买菜',
        },
        {
          component: 'bottom-grid',
          type: 'coupon',
          required: true,
          query: '盒马鲜生',
        },
      ],
    }, {
      createLocationId: () => `location-${++nextId}`,
    })

    expect(issues).toEqual([])
    expect(ir.components.map(component => component.locationId)).toEqual([
      'location-1',
      'location-2',
    ])
    expect(ir.resources.map(resource => resource.locationId)).toEqual([
      'location-1',
      'location-2',
    ])
  })

  it('rejects unknown component ownership and non-boolean required flags', () => {
    const { issues } = normalizeInitializationIr({
      intent: '配置资源',
      components: [{ key: 'entry-grid', type: 'jgq' }],
      resources: [{
        component: 'missing-grid',
        type: 'app',
        required: 'yes',
        query: '叮咚买菜',
      }],
    })

    expect(issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining([
        'unknown_resource_component',
        'invalid_resource_required',
      ]),
    )
  })

  it('validates component ownership without resource-slot metadata', () => {
    const { ir } = normalizeInitializationIr({
      intent: '配置金刚区',
      components: [{ key: 'entry-grid', type: 'jgq' }],
      resources: [
        {
          component: 'entry-grid',
          type: 'app',
          required: true,
          query: '叮咚买菜',
        },
        {
          component: 'entry-grid',
          type: 'coupon',
          required: true,
          query: '盒马鲜生',
        },
      ],
    })

    expect(validateInitializationIr(ir, catalog).ok).toBe(true)
    expect('resourceSlots' in catalog.widgets[0]).toBe(false)
  })

  it('associates standard props and resources with the same location record', () => {
    const { ir } = normalizeInitializationIr({
      intent: '配置金刚区',
      components: [{ key: 'top-grid', type: 'jgq' }],
      resources: [],
    }, { createLocationId: () => 'location-top-grid' })
    const context = {
      initialization: {
        ir,
        requestId: 'request-1',
        locations: createInitializationLocations(ir, catalog),
        status: 'ready' as const,
        conflicts: [],
        unresolved: [],
        ignored: [],
      },
    }
    const location = context.initialization.locations['location-top-grid']
    expect(location.standardProps).toEqual({ isShow: 1 })
    location.resources.app = [{
      type: 'app',
      query: '叮咚买菜',
      status: 'resolved',
    }]

    const merged = mergeInitializationLocationProps(
      context,
      'location-top-grid',
      { isShow: 0 },
    )

    expect(merged).toBe(location)
    expect(location.standardProps).toEqual({ isShow: 0 })
    expect(location.resources.app).toHaveLength(1)
  })
})
