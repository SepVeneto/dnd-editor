import type { IWidget } from '@sepveneto/dnde-core'

export class Widget {
  public name: string
  public schema: string
  public view: string
  public type?: string

  constructor(widget: IWidget<object>) {
    this.name = widget._name
    this.schema = widget._schema
    this.view = widget._view
  }

  clone(): Widget {
    return JSON.parse(JSON.stringify(this))
  }
}
