import type { Widget } from './Widget'
import { v4 } from 'uuid'

export class Node {
  public wid: string
  public widget?: Widget
  public parent?: Node
  public list: Node[] = []
  constructor(widget?: Widget) {
    if (widget) {
      this.widget = widget.clone()
    }
    this.wid = v4()
  }

  get type() {
    return this.widget?.view || 'root'
  }

  get name() {
    return this.widget?.name || '页面'
  }

  setList(list: Node[]) {
    console.log('set', list)
    this.list = list
  }
}

export class RootNode extends Node {
  constructor() {
    super()
  }
}
