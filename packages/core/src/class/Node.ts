import type { CSSProperties } from 'vue'
import type { Widget } from './Widget'
import { v4 } from 'uuid'

export class Node {
  public level = 0
  public wid: string
  public widget: Readonly<Widget>
  public parent?: Node
  public list: Node[] = []
  public data: Record<string, any> = {}
  public style: CSSProperties = {}
  public hovering: boolean = false
  public dragging: boolean = false
  constructor(widget: Widget, info?: { props?: Node['data'], style?: Node['style'], list?: Node['list'] }) {
    this.widget = widget
    this.wid = v4()
    this.list = info?.list || []
    this.data = info?.props || {}
    this.style = info?.style || {}
  }

  get info() {
    return {
      style: this.style,
      ...this.data,
    }
  }

  get isContainer() {
    return !!this.widget.container
  }

  get hasList() {
    return this.list && this.list.length > 0
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

  get visible() {
    if ('isShow' in this.data)
      return Boolean(this.data.isShow)
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
    if (only || !this.list) {
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
    const list = this.list?.map(item => item.copy())
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
      list: this.list?.map(item => item.parse()),
    }
    return res
  }
}

export class RootNode {
  public level = 0
  public wid: string
  public widget: Readonly<Widget>
  public parent?: Node
  public list: any[] = []
  public data: Record<string, any> = {}
  public style: CSSProperties = {}
  public hovering: boolean = false
  public dragging: boolean = false
  constructor(widget: Widget, info?: { props?: Node['data'], style?: Node['style'], list?: Node['list'] }) {
    this.widget = widget
    this.wid = v4()
    // this.list = info?.list || []
    this.data = info?.props || {}
    this.style = info?.style || {}
  }
}
