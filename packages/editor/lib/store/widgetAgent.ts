import type { Node, WidgetLayoutItem } from '@sepveneto/dnde-core'

export function serializeWidgetAgentNode(node: Node): unknown {
  const nodeIR = node.widget.agent?.nodeIR
  if (nodeIR)
    return nodeIR(node)

  return {
    id: node.wid,
    type: node.type,
    name: node.name,
    data: node.data,
    style: node.style,
    children: node.list?.map(serializeWidgetAgentNode) ?? [],
  }
}

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
