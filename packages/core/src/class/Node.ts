import type { Widget } from './Widget'
import { v4 } from 'uuid'

export class Node {
  public wid: string
  public widget?: Readonly<Widget>
  public parent?: Node
  public list: Node[] = []
  constructor(widget?: Widget) {
    this.widget = widget
    this.wid = v4()
  }

  get type() {
    return this.widget?.view || 'root'
  }

  get name() {
    return this.widget?.name || '页面'
  }

  setList(list: Node[]) {
    this.list = list
  }

  copy() {
    return new Node(this.widget?.clone())
  }
}

export class RootNode extends Node {
  constructor() {
    super()
  }
}
