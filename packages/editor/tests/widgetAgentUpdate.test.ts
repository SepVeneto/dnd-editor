import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyWidgetAgentUpdate } from '../lib/store/widgetAgent.ts'

describe('widget.agent.update', () => {
  it('passes the component and changes through the DSL execution helper', async () => {
    const calls: unknown[] = []
    const node = {
      type: 'card',
      widget: {
        agent: {
          update(_node: unknown, item: unknown, context: unknown) {
            calls.push({ item, context })
          },
        },
      },
    } as any
    const context = { requestId: 'request-1' }

    await applyWidgetAgentUpdate(node, { title: '更新' }, context)

    assert.deepEqual(calls, [{
      item: {
        widget: 'card',
        items: [],
        changes: { title: '更新' },
      },
      context,
    }])
  })
})
