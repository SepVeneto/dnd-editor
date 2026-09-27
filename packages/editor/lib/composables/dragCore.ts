import type { Node } from '@sepveneto/dnde-core/class'

/** 拖拽逻辑作用的目标列表 */
export interface DragTarget {
  /** 当前列表（响应式数组） */
  list: Node[]
  /** 列表所属的父节点，根列表传 rootNode */
  parent: Node
  /** 用新数组替换当前列表 */
  setList: (list: Node[]) => void
}

/** 拖拽逻辑需要的外部能力，由编辑器 store 提供 */
export interface DragHost {
  /** 跨容器拖动被撤销时，把节点还原回指定容器的指定位置 */
  restoreToContainer: (containerId: string, index: number, node: Node) => void
  /** 把节点登记到目标父节点下 */
  addNode: (node: Node, parent: Node) => void
}

/** 只取逻辑用到的字段，便于在测试中构造 */
export interface DragAddEvent {
  newIndex: number
  newDraggableIndex: number
  oldIndex: number
  from: { dataset: { id?: string } }
  to: { dataset: { id?: string } }
}

/**
 * 找出列表中第一处重复出现的 wid。
 *
 * vuedraggable 在同级跨列表拖动时，会在目标列表里留下源列表的重复项，
 * 靠这个函数定位需要清理的节点。
 */
export function findDuplicatedWid(list: Node[]): string | undefined {
  const seen = new Set<string>()
  for (const item of list) {
    if (seen.has(item.wid))
      return item.wid

    seen.add(item.wid)
  }
  return undefined
}

/**
 * 该位置是否紧邻 fixed 节点（header 之后 / footer 之前都不允许插入）。
 *
 * 注意：入参是 `Widget.isFixed` 归一化之后的值，即 `meta.fixed: true` 会变成 `'header'`。
 */
export function isFixedBoundary(list: Node[], index: number): boolean {
  const prev = list[index - 1]
  const next = list[index + 1]
  return Boolean(
    (prev && prev.widget.isFixed === 'footer')
    || (next && next.widget.isFixed === 'header'),
  )
}

/**
 * 计算跨列表拖动后应从后一个数组中移除的重复项下标。
 *
 * `originIndex` 是被拖动节点在原数组中的位置，用来判断它在新数组里是上移还是下移。
 * 返回 -1 表示不删除（没有重复，或相邻是 fixed 边界需要保留）。
 */
export function resolveDuplicateRemovalIndex(
  current: Node[],
  next: Node[],
  wid: string,
  originIndex: number,
): number {
  const movedForward = wid === next[originIndex]?.wid
  // 旧元素在上方时看最后一个重复项，在下方时看第一个
  const duplicateIndex = movedForward
    ? next.findLastIndex(node => node.wid === wid)
    : next.findIndex(node => node.wid === wid)

  if (isFixedBoundary(next, duplicateIndex))
    return -1

  return movedForward ? originIndex : originIndex + 1
}

/**
 * 处理一次「放入」：
 * - 落点紧邻 fixed 节点时撤销这次插入；
 * - 跨容器拖动被撤销时，把节点还原回原容器；
 * - 否则把节点登记到目标父节点下。
 */
export function handleNodeAdd(target: DragTarget, evt: DragAddEvent, host: DragHost): void {
  const list = target.list
  if (isFixedBoundary(list, evt.newIndex)) {
    const [removed] = list.splice(evt.newIndex, 1)
    const containerId = evt.from.dataset.id

    // 跨容器移动触发 fixed 时需要手动还原到旧容器中；
    // 没有容器 id 说明是从组件栏中拖动的，不需要还原
    if (evt.to !== evt.from && containerId && removed)
      host.restoreToContainer(containerId, evt.oldIndex, removed)

    return
  }

  const node = list[evt.newDraggableIndex]
  if (node)
    host.addNode(node, target.parent)
}

/**
 * 处理列表更新：
 * - 长度没有增加（同级重排）→ 直接整体替换；
 * - 长度增加（跨列表拖动）→ 清理 vuedraggable 留下的重复项，
 *   若重复项紧邻 fixed 边界则保留。
 *
 * `defer` 用于把清理后的写入推迟到下一个 tick（与 vuedraggable 的更新时机对齐）。
 */
export function handleNodeInput(target: DragTarget, val: Node[], defer: (fn: () => void) => void): void {
  if (target.list.length >= val.length) {
    target.setList(val)
    return
  }

  const wid = findDuplicatedWid(val)
  if (wid === undefined) {
    target.setList(val)
    return
  }

  const originIndex = target.list.findIndex(node => node.wid === wid)
  if (originIndex === -1) {
    target.setList(val)
    return
  }

  const removeIndex = resolveDuplicateRemovalIndex(target.list, val, wid, originIndex)
  if (removeIndex !== -1)
    val.splice(removeIndex, 1)

  defer(() => target.setList(val))
}
