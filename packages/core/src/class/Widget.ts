import type { Rule } from 'async-validator'
import type { ElOption, FormItemRule, InputInstance, InputNumberInstance, SelectInstance } from 'element-plus'
import type { IWidget } from '@/types'
import Validator from 'async-validator'

type Option = InstanceType<typeof ElOption>

interface SchemaItemBase { rules?: FormItemRule | FormItemRule[] }
interface ShcemaItemInput extends SchemaItemBase { label: string, key: string, type: 'input', attrs?: InputInstance['$props'] }
interface SchemaItemSelect extends SchemaItemBase { label: string, key: string, type: 'select', options?: Option['$props'][], attrs?: SelectInstance['$props'] }
interface SchemaItemNumber extends SchemaItemBase { label: string, key: string, type: 'number', attrs?: InputNumberInstance['$props'] }

export type SchemaItem = ShcemaItemInput | SchemaItemSelect | SchemaItemNumber

export class Widget {
  public name: string
  public view: string
  public _data: IWidget<object>

  constructor(widget: IWidget<object>) {
    this._data = JSON.parse(JSON.stringify(widget))
    this.name = widget._name
    this.view = widget._view
  }

  clone(): Widget {
    return new Widget(this._data)
  }

  get icon(): string | undefined {
    return this._data._icon
  }

  get props(): SchemaItem[] {
    return this._data.schema?.props || []
  }

  get style(): SchemaItem[] {
    return this._data.schema?.style || []
  }

  get draggable() {
    return this._data.meta?.draggable ?? true
  }

  get validatorProps() {
    const _rules = this._data.schema?.props?.reduce<Record<string, Rule>>((all, curr) => {
      all[curr.key] = curr.rules || []
      return all
    }, {}) || {}
    const validator = new Validator(_rules)
    return validator
  }
  get validatorStyle() {
    const _rules = this._data.schema?.style?.reduce<Record<string, Rule>>((all, curr) => {
      all[curr.key] = curr.rules || []
      return all
    }, {}) || {}
    const validator = new Validator(_rules)
    return validator
  }
}
