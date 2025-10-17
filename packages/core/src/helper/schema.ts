import type {
  ColorPickerInstance,
  DatePickerInstance,
  FormItemProps,
  // ImageInstance,
  InputInstance,
  InputNumberInstance,
  RadioInstance,
  SelectInstance,
  SwitchInstance,
} from 'element-plus'
import type { Option, RadioButtonOption, RadioOption, SchemaItem, SchemaItemCustom } from '@/class'
import { likeArray } from '@/utils'

interface BaseConfig {
  label: SchemaItem['label']
  key: SchemaItem['key']
  tips?: string
  formItem?: Partial<FormItemProps>
  required?: boolean | string
  rules?: SchemaItem['rules']
}

export const schema = {
  _create(type: any, config: BaseConfig & { attrs?: any }): SchemaItem {
    const base: SchemaItem = {
      label: config.label,
      key: config.key,
      type,
      formItem: config.formItem,
      rules: normalizeRules(config),
      attrs: config.attrs,
    }
    return base
  },
  input(config: BaseConfig & { attrs?: InputInstance['$props'] }): SchemaItem {
    return this._create('input', config)
  },
  number(config: BaseConfig & { attrs?: InputNumberInstance['$props'] }): SchemaItem {
    return this._create('number', config)
  },
  select(
    config: BaseConfig & { attrs?: SelectInstance['$props'], options?: Option['$props'][] },
  ): SchemaItem {
    return this._create('select', config)
  },
  radio(config: BaseConfig & { attrs?: RadioInstance['$props'], options?: RadioOption['$props'][] }): SchemaItem {
    return this._create('radio', config)
  },
  radioButton(config: BaseConfig & { attrs?: RadioInstance['$props'], options?: RadioButtonOption['$props'][] }): SchemaItem {
    return this._create('radioButton', config)
  },
  switch(config: BaseConfig & { attrs?: SwitchInstance['$props'] }): SchemaItem {
    return this._create('switch', config)
  },
  time(config: BaseConfig & { attrs?: Partial<DatePickerInstance['$props']> }): SchemaItem {
    return this._create('datetimePicker', config)
  },
  color(config: BaseConfig & { attrs?: ColorPickerInstance['$props'] }): SchemaItem {
    return this._create('colorPicker', config)
  },
  custom(config: BaseConfig & { attrs?: Record<string, any>, type: string }): SchemaItem {
    const res: SchemaItemCustom = {
      ...this._create('custom', config),
      type: 'custom',
      name: config.type,
    }
    return res
  },

  styleNumber(
    config: BaseConfig,
  ): SchemaItem {
    return this._create('styleNumber', config)
  },
}

function normalizeRules(config: BaseConfig) {
  const rules = likeArray(config.rules || [])
  if (config.required) {
    if (typeof config.required === 'string') {
      rules.push({
        required: true,
        message: config.required,
      })
    }
    else if (config.required) {
      rules.push({
        required: true,
        message: `请填写${config.label}`,
      })
    }
  }
  return rules
}
