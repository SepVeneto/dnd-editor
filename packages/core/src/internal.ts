import type { Node } from './class'
import { inject } from 'vue'
import { EditorContext } from './tokens'

export const createCopy = (ctx: any) => ({
  name: 'copy',
  title: '复制',
  action: (node: Node) => {
    ctx.addNode(node.copy(), node.parent, true)
  },
})

export const createDelete = (ctx: any) => ({
  name: 'delete',
  title: '删除',
  action: (node: Node) => {
    ctx.delNode(node.wid)
  },
})
