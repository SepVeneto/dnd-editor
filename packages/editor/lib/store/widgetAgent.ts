import type { Node, WidgetLayoutItem } from '@sepveneto/dnde-core'

export async function applyWidgetAgentUpdate(
  node: Node,
  changes: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  const item: WidgetLayoutItem = {
    widget: node.type,
    items: [],
    changes,
  }
  await node.widget.agent?.update?.(node, item, context)
}
