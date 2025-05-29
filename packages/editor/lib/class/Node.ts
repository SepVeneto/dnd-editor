import type { Widget } from './Widget'
import { v4 } from 'uuid'

export class Node {
  public wid: string
  public widget: Widget
  constructor(widget: Widget) {
    this.widget = widget.clone()
    this.wid = v4()
  }

  get type() {
    return this.widget.view
  }
}
