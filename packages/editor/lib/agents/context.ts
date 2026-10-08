import type { LayoutWidgetDescriptor } from '@agent/sdk'

/**
 * 把编辑器组件列表拍平成 Layout Agent 需要的描述。
 *
 * 输入可能是分组、Widget 实例或原始 IWidget，这里统一递归处理。
 * 只有带 `agent` 描述的组件才会进入布局候选。
 */
export function toLayoutWidgets(widgets: any[] = []): LayoutWidgetDescriptor[] {
  const result: LayoutWidgetDescriptor[] = []

  const visit = (item: any) => {
    if (!item)
      return

    if (Array.isArray(item.list)) {
      item.list.forEach(visit)
      return
    }

    const data = item._data ?? item
    const typeId = item.view ?? data._view
    const agent = data.agent

    if (!typeId || !agent)
      return

    result.push({
      typeId,
      description: agent.description ?? '',
      layout: agent.layout ?? {},
    })
  }

  widgets.forEach(visit)
  return result
}

/** 当前页面节点的轻量快照，供 Edit Agent 定位组件。 */
export function snapshotNodes(nodes: any[] = []): Array<{ wid: string, type: string, name: string }> {
  return nodes.map(node => ({
    wid: node.wid,
    type: node.type,
    name: node.name,
  }))
}
