import type { CSSProperties, Reactive, Ref } from 'vue'
import { v4 } from 'uuid'
import { ref } from 'vue'
import { Widget } from './Widget'

export class Node {
  public wid: string
  public widget: Readonly<Widget>
  public parent?: Node
  public list: Node[] = []
  public data: Record<string, any> = {}
  public style: CSSProperties = {}
  constructor(widget: Widget, info?: { props?: Node['data'], style?: Node['style'], list?: Node['list'] }) {
    this.widget = widget
    this.wid = v4()
    this.list = info?.list || []
    this.data = info?.props || {}
    this.style = info?.style || {}
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

  copy(): Node {
    const info = {
      props: JSON.parse(JSON.stringify(this.data)),
      style: JSON.parse(JSON.stringify(this.style)),
      list: this.list.map(item => item.copy()),
    }
    return new Node(this.widget.clone(), info)
  }

  public parse(): Record<string, any> {
    const res = {
      _uuid: this.wid,
      _name: this.name,
      _view: this.type,
      // TODO
      isShow: true,
      ...this.data,
      style: this.style,
      list: this.list.map(item => item.parse()),
    }
    return res
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
