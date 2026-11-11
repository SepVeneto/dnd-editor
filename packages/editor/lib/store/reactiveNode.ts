import type { Node } from '@sepveneto/dnde-core/class'
import { reactive } from 'vue'

/**
 * 编辑器的文档树依赖 Vue 的深层响应式代理。业务侧拿到 addNode 的返回值后
 * 会直接修改 node.data，因此注册到 nodeMap / 文档树中的必须是同一代理。
 */
export function toReactiveNode(node: Node): Node {
  return reactive(node) as Node
}
