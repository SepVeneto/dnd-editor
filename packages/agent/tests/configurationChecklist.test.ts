/* eslint-disable test/no-import-node-test */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Runner } from '@openai/agents'
import {
  assistantMessage,
  functionCall,
  ScriptedModel,
} from '@openai/agents/testing'
import { z } from 'zod'
import { createAgents } from '../src/agents.ts'
import { defineAgentTool } from '../src/tool.ts'
import { AGENT_TOOL_EXECUTION } from '../src/toolExecution.ts'

const catalog = {
  catalogVersion: '1.0',
  widgets: [{
    type: 'jgq',
    name: '金刚区',
    description: '',
    defaultData: {},
    defaultStyle: {},
    fields: [],
    customTypes: [{
      type: 'jgq',
      capabilities: [{
        name: 'entry.items.append',
        resourceTypes: ['app', 'coupon', 'link'],
        maxItems: 8,
        semantics: 'append',
        idempotent: false,
        destructive: false,
        writableScope: 'content',
      }],
    }],
    staticOptions: [],
  }, {
    type: 'shopPickup',
    name: '扫码提货',
    description: '',
    defaultData: {},
    defaultStyle: {},
    fields: [{
      source: 'prop',
      key: 'model',
      label: '显示模块',
      valueType: 'enum',
      enum: ['pickup', 'code', 'brand'],
      scope: 'content',
      required: false,
      readOnly: false,
    }],
    customTypes: [],
    staticOptions: [],
  }],
}

describe('configuration checklist agent flow', () => {
  it('passes normalized IR to the host and hides raw resolved objects from the model', async () => {
    const appliedNodes: any[] = []
    const createQueryTool = (type: 'app' | 'coupon', query: string, value: any) =>
      defineAgentTool({
        name: `query_${type}_resources`,
        description: `${type} query`,
        inputSchema: z.object({ queries: z.array(z.string()).min(1) }),
        async execute(input, { context }) {
          const initialization = context.initialization
          const locationId = initialization.ir.resources.find(
            (resource: any) => resource.type === type && resource.query === query,
          ).locationId
          const location = initialization.locations[locationId]
          const group = location.resources
          const typeResources = group[type] ?? []
          typeResources.push({
            locationId,
            component: 'entry-grid',
            type,
            query,
            status: 'resolved',
            value,
            sourceTool: `${type}-query`,
            underlyingId: `${type}-result`,
          })
          group[type] = typeResources
          location.resources = group
          const resolved = new Set(
            Object.values(initialization.locations)
              .flatMap((entry: any) => Object.values(entry.resources).flat())
              .map((resource: any) => `${resource.locationId}:${resource.type}:${resource.query}`),
          )
          initialization.status = initialization.ir.resources.every(
            (resource: any) => resolved.has(`${resource.locationId}:${resource.type}:${resource.query}`),
          )
            ? 'ready'
            : 'pending_resources'
          return {
            ok: true,
            status: 'ready',
            resources: input.queries.map(queryText => ({
              locationId,
              component: 'entry-grid',
              type,
              query: queryText,
              status: 'resolved',
            })),
            conflicts: [],
            unresolved: [],
            ignored: [],
          }
        },
      })
    const { checklistAgent } = createAgents({
      tools: [
        createQueryTool('app', '叮咚买菜', {
          secretBusinessObject: 'do-not-leak',
        }),
        createQueryTool('coupon', '盒马鲜生', {
          secretBusinessObject: 'do-not-leak',
        }),
      ],
      api: {
        editor: {
          getCurrentEditor: () => ({ revision: 7, page: { list: [] } }),
          getWidgets: () => catalog,
          getCapabilities: () => catalog,
          validateDsl: () => ({ ok: true, issues: [] }),
          addNode: (operation: any, context: any) => {
            appliedNodes.push({ operation, context })
            return { ok: true, revision: 7 }
          },
          applyDsl: (_dsl: any) => {
            return { ok: true, revision: 7 }
          },
          operateEditor: () => ({ ok: true }),
        },
      },
    })

    const model = new ScriptedModel([
      [functionCall('get_current_editor', {}, { callId: 'current-1' })],
      [functionCall('get_widgets', {}, { callId: 'widgets-1' })],
      [functionCall('prepare_initialization', {
        intent: '配置外接场景、卡券品牌和门店提货',
        components: [
          {
            key: 'entry-grid',
            type: 'jgq',
          },
          {
            key: 'pickup-module',
            type: 'shopPickup',
          },
        ],
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
      }, { callId: 'prepare-1' })],
      [functionCall('query_app_resources', {
        queries: ['叮咚买菜'],
      }, { callId: 'query-app-1' })],
      [functionCall('query_coupon_resources', {
        queries: ['盒马鲜生'],
      }, { callId: 'query-coupon-1' })],
      [functionCall('add_editor_node', {
        resourceId: 'resource-entry-grid',
      }, { callId: 'add-1' })],
      [functionCall('add_editor_node', {
        resourceId: 'resource-pickup-module',
      }, { callId: 'add-2' })],
      [assistantMessage('配置完成')],
    ])
    const runner = new Runner({
      modelProvider: { getModel: () => model },
      toolExecution: AGENT_TOOL_EXECUTION,
    })

    const result = await runner.run(checklistAgent, '按清单配置', {
      context: {},
    })
    const initialization = (result.runContext.context as any).initialization
    const preparedIr = initialization.ir

    assert.equal(preparedIr.baseDocRevision, 7)
    assert.equal(typeof preparedIr.components[0].locationId, 'string')
    assert.equal(preparedIr.components[0].locationId.length > 0, true)
    assert.equal(preparedIr.components[1].locationId === preparedIr.components[0].locationId, false)
    assert.deepEqual(
      preparedIr.resources.map((resource: any) => resource.locationId),
      [preparedIr.components[0].locationId, preparedIr.components[0].locationId],
    )
    assert.deepEqual(
      preparedIr.components.map((component: any) => component.type),
      ['jgq', 'shopPickup'],
    )
    assert.equal('placement' in preparedIr.components[0], false)
    assert.equal('resources' in preparedIr.components[0], false)
    const toolOutputs = (result.state as any).toJSON().generatedItems.map((item: any) => item.output)
    assert.doesNotMatch(JSON.stringify(toolOutputs), /do-not-leak/)
    assert.equal(initialization.status, 'ready')
    const resourceEntries = Object.values(
      initialization.locations[preparedIr.components[0].locationId].resources,
    ).flat()
    assert.equal(resourceEntries.length, 2)
    assert.deepEqual(
      resourceEntries.map((resource: any) => resource.status),
      ['resolved', 'resolved'],
    )
    assert.deepEqual(
      appliedNodes.map(item => item.operation),
      [
        { locationId: 'resource-entry-grid' },
        { locationId: 'resource-pickup-module' },
      ],
    )
  })
})
