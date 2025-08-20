import type { CSSProperties } from 'vue'
import type { Widget } from './Widget'
import type { IWidget } from '@/types'
import { v4 } from 'uuid'

export class Node {
  public wid: string
  public widget: Readonly<Widget>
  public parent?: Node
  public list: Node[] = []
  public data: Record<string, any> = {}
  public style: CSSProperties = {}
  public hovering: boolean = false
  constructor(widget: Widget, info?: { props?: Node['data'], style?: Node['style'], list?: Node['list'] }) {
    this.widget = widget
    this.wid = v4()
    this.list = info?.list || []
    this.data = info?.props || {}
    this.style = info?.style || {}
  }

  get mouseover() {
    return this.hovering
  }

  get type() {
    return this.widget?.view || 'root'
  }

  get name() {
    return this.widget?.name || '页面'
  }


  async validate(only = false): Promise<string | undefined> {
    const valid = await Promise.all([
      this.widget.validatorProps.validate(this.data),
      this.widget.validatorStyle.validate(this.style),
    ]).catch(() => {
      return false
    })
    if (!valid) {
      return this.wid
    }
    if (only) {
      return
    }
    for (const item of this.list) {
      const invalid = await item.validate()
      if (invalid) {
        return invalid
      }
    }
  }

  triggerHover(hover: boolean) {
    this.hovering = hover
  }

  setList(list: Node[]) {
    this.list = list
  }

  copy(): Node {
    const list = this.list.map(item => item.copy())
    const info = {
      props: JSON.parse(JSON.stringify(this.data)),
      style: JSON.parse(JSON.stringify(this.style)),
      list,
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
  constructor(widget: Widget) {
    super(widget)
  }

  setSchema(schema: IWidget['schema']) {
    this.widget._data.schema = schema
  }
}
