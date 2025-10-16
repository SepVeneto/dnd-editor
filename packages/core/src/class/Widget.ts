import type { Rule } from 'async-validator'
import type { ColorPickerInstance, DatePickerInstance, ElOption, ElRadio, ElRadioButton, FormItemProps, FormItemRule, ImageInstance, InputInstance, InputNumberInstance, RadioGroupInstance, SelectInstance, SwitchInstance } from 'element-plus'
import type { IWidget } from '@/types'
import Validator from 'async-validator'

export type Option = InstanceType<typeof ElOption>
export type RadioOption = InstanceType<typeof ElRadio>
export type RadioButtonOption = InstanceType<typeof ElRadioButton>

interface SchemaItemBase {
  label: string
  key: string
  formItem?: Partial<FormItemProps>
  rules?: FormItemRule | FormItemRule[]
}
interface SchemaItemInput extends SchemaItemBase { type: 'input', attrs?: InputInstance['$props'] }
interface SchemaItemSelect extends SchemaItemBase { type: 'select', options?: Option['$props'][], attrs?: SelectInstance['$props'] }
interface SchemaItemNumber extends SchemaItemBase { type: 'number', attrs?: InputNumberInstance['$props'] }
interface SchemaItemSwitch extends SchemaItemBase { type: 'switch', attrs?: SwitchInstance['$props'] }
interface SchemaItemImage extends SchemaItemBase { type: 'image', attrs?: ImageInstance['$props'] }
interface SchemaItemDatetimePicker extends SchemaItemBase { type: 'datetimePicker', attrs?: Partial<DatePickerInstance['$props']> }
interface SchemaItemColorPicker extends SchemaItemBase { type: 'colorPicker', attrs?: ColorPickerInstance['$props'] }
interface SchemaItemCustom extends SchemaItemBase {
  type: 'custom'
  name: string
  attrs?: Record<string, any>
}
interface SchemaItemStyleNumber extends SchemaItemBase {
  type: 'styleNumber'
}
interface SchemaItemRadio extends SchemaItemBase { type: 'radio', attrs?: RadioGroupInstance['$props'], options?: RadioOption['$props'][] }
interface SchemaItemRadioButton extends SchemaItemBase { type: 'radioButton', attrs?: RadioGroupInstance['$props'], options?: RadioButtonOption['$props'][] }

export type SchemaItem = SchemaItemInput |
  SchemaItemSelect |
  SchemaItemNumber |
  SchemaItemSwitch |
  SchemaItemImage |
  SchemaItemCustom |
  SchemaItemStyleNumber |
  SchemaItemRadio |
  SchemaItemRadioButton |
  SchemaItemDatetimePicker |
  SchemaItemColorPicker

export class Widget {
  public name: string
  public view: string
  public _data: IWidget
  public container: IWidget['container']

  constructor(widget: IWidget) {
    this._data = JSON.parse(JSON.stringify(widget))
    this.name = widget._name
    this.view = widget._view
    this.container = widget.container
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

  get defaultStyle() {
    return this._data.style
  }

  get defaultData() {
    return this._data.data
  }

  get draggable() {
    return this._data.meta?.draggable ?? true
  }

  get isFixed() {
    return this._data.meta?.fixed
  }

  get visible() {
    return this._data.meta?.visible ?? true
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
