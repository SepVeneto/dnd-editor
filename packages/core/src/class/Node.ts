import type { CSSProperties, Reactive, Ref } from 'vue'
import { v4 } from 'uuid'
import { ref } from 'vue'
import { Widget } from './Widget'

export class Node {
  public wid: string
  public widget: Readonly<Widget>
  public parent?: Node
  public list: Node[] = []
  public data: Record<string, any> = { title: '' }
  public style: CSSProperties = {}
  constructor(widget: Widget) {
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
    return new Node(this.widget.clone())
  }
}

export class RootNode extends Node {
  constructor() {
    super(new Widget({
      _name: '页面',
      _view: 'page',
      schema: {
        props: [
          { label: '标题', type: 'input', key: 'title', rules: [{ required: true, message: '1' }] },
          { label: '数字', type: 'number', key: 'num' },
          { label: '选择器', type: 'select', key: 'opts', options: [{ label: '选项1', value: 'option1' }, { label: '选项2', value: 'option2' }] },
        ],
      },
    }))
  }
}
