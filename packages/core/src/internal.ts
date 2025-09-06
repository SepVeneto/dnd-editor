import type { Node } from './class'

export function createCopy(ctx: any) {
  return {
    name: 'copy',
    title: '复制',
    action: (node: Node) => {
      ctx.addNode(node.copy(), node.parent, true)
    },
  }
}

export function createDelete(ctx: any) {
  return {
    name: 'delete',
    title: '删除',
    action: (node: Node) => {
      ctx.delNode(node.wid)
    },
  }
}
