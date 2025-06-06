import type { IWidget } from '@/types'

export class Widget {
  public name: string
  public view: string
  public type?: string
  private _data: IWidget<object>

  constructor(widget: IWidget<object>) {
    this._data = JSON.parse(JSON.stringify(widget))
    this.name = widget._name
    this.view = widget._view
  }

  clone(): Widget {
    return new Widget(this._data)
  }

  get props() {
    return this._data.schema?.props || {}
  }

  get style() {
    return this._data.schema?.style || {}
  }

  get draggable() {
    return this._data.meta?.draggable ?? true
  }
}
