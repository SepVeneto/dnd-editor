import type { Widget } from './Widget'
import { v4 } from 'uuid'

export class Node {
  public wid: string
  public widget: Widget
  public list: Node[] = []
  constructor(widget: Widget) {
    this.widget = widget.clone()
    this.wid = v4()
  }

  get type() {
    return this.widget.view
  }

  setList(list: Node[]) {
    console.log('set', list)
    this.list = list
  }
}
