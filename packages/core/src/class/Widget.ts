import type { Rule } from 'async-validator'
import type {
  CheckboxProps,
  ColorPickerProps,
  DatePickerProps,
  FormItemProps,
  FormItemRule,
  InputNumberProps,
  InputProps,
  RadioGroupProps,
  radioOptionProp,
  SelectOptionProps,
  SelectProps,
  SwitchProps,
  ElOption,
  ElRadio,
  ElRadioButton,
} from 'element-plus'
import type { IWidget } from '@/types'
import Validator from 'async-validator'

export type Option = InstanceType<typeof ElOption>['$props']
export type RadioOption = InstanceType<typeof ElRadio>['$props']
export type RadioButtonOption = InstanceType<typeof ElRadioButton>['$props']

interface SchemaItemBase {
  /** @private */
  _role?: string
  label: string
  key: string
  formItem?: Partial<FormItemProps>
  rules?: FormItemRule | FormItemRule[]
}
interface SchemaItemInput extends SchemaItemBase { type: 'input', attrs?: InputProps }
interface SchemaItemSelect extends SchemaItemBase {
  type: 'select'
  options?: Option[]
  attrs?: SelectProps
  link?: Record<string | number, SchemaItem[]>
}
interface SchemaItemNumber extends SchemaItemBase { type: 'number', attrs?: InputNumberProps }
interface SchemaItemSwitch extends SchemaItemBase { type: 'switch', attrs?: SwitchProps }
interface SchemaItemDatetimePicker extends SchemaItemBase { type: 'datetimePicker', attrs?: DatePickerProps }
interface SchemaItemColorPicker extends SchemaItemBase { type: 'colorPicker', attrs?: ColorPickerProps }
interface SchemaItemCheckbox extends SchemaItemBase { type: 'checkbox', attrs?: CheckboxProps }
export interface SchemaItemCustom extends SchemaItemBase {
  type: 'custom'
  name: string
  attrs?: Record<string, any>
}
interface SchemaItemStyleNumber extends SchemaItemBase {
  type: 'styleNumber'
}
interface SchemaItemRadio extends SchemaItemBase {
  type: 'radio'
  attrs?: RadioGroupProps
  options?: RadioOption[]
  link?: Record<string | number, SchemaItem[]>
}
interface SchemaItemRadioButton extends SchemaItemBase {
  type: 'radioButton'
  attrs?: RadioGroupProps
  options?: RadioButtonOption[]
  link?: Record<string | number, SchemaItem[]>
}

export type SchemaItem = SchemaItemInput
  | SchemaItemSelect
  | SchemaItemNumber
  | SchemaItemSwitch
  | SchemaItemCustom
  | SchemaItemStyleNumber
  | SchemaItemRadio
  | SchemaItemRadioButton
  | SchemaItemDatetimePicker
  | SchemaItemColorPicker
  | SchemaItemCheckbox

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
    const fixed = this._data.meta?.fixed
    if (fixed === true) {
      return 'header'
    }
    else {
      return fixed
    }
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
