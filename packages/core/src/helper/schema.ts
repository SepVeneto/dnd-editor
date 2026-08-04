import type {
  FormItemProps,
  CheckboxProps,
  InputProps,
  InputNumberProps,
  SelectProps,
  RadioProps,
  RadioButtonProps,
  SwitchProps,
  DatePickerProps,
  ColorPickerProps,
} from 'element-plus'
import type { Option, RadioButtonOption, RadioOption, SchemaItem, SchemaItemCustom } from '@/class'
import { likeArray } from '@/utils'

interface BaseConfig {
  /** @private */
  _role?: string
  label: SchemaItem['label']
  key: SchemaItem['key']
  tips?: string
  formItem?: Partial<FormItemProps>
  required?: boolean | string
  rules?: SchemaItem['rules']
}

export const schema = {
  _create(type: any, config: BaseConfig & { attrs?: any, options?: any, link?: any }): SchemaItem {
    const base: SchemaItem = {
      _role: config._role,
      label: config.label,
      key: config.key,
      type,
      formItem: config.formItem,
      rules: normalizeRules(config),
      attrs: config.attrs,
    }
    switch (type) {
      case 'select':
      case 'radio':
      case 'radioButton':
        return { ...base, type, options: config.options, link: config.link }
      default:
        return base
    }
  },
  input(config: BaseConfig & { attrs?: InputProps }): SchemaItem {
    return this._create('input', config)
  },
  number(config: BaseConfig & { attrs?: InputNumberProps }): SchemaItem {
    return this._create('number', config)
  },
  checkbox(config: BaseConfig & { attrs?: CheckboxProps }): SchemaItem {
    return this._create('checkbox', config)
  },
  select(
    config: BaseConfig & { attrs?: SelectProps, options?: Option[], link?: Record<string, SchemaItem[]> },
  ): SchemaItem {
    return this._create('select', config)
  },
  radio(config: BaseConfig & { attrs?: RadioProps, options?: RadioOption[], link?: Record<string, SchemaItem[]> }): SchemaItem {
    return this._create('radio', config)
  },
  radioButton(config: BaseConfig & { attrs?: RadioButtonProps, options?: RadioButtonOption[], link?: Record<string, SchemaItem[]> }): SchemaItem {
    return this._create('radioButton', config)
  },
  switch(config: BaseConfig & { attrs?: SwitchProps }): SchemaItem {
    return this._create('switch', config)
  },
  time(config: BaseConfig & { attrs?: DatePickerProps }): SchemaItem {
    return this._create('datetimePicker', config)
  },
  color(config: BaseConfig & { attrs?: ColorPickerProps }): SchemaItem {
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

  topbar(config: BaseConfig & { attrs?: RadioProps, options?: RadioOption[], link?: Record<string, SchemaItem[]> }): SchemaItem {
    return this.radio({ ...config, _role: 'topbar' })
  }
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
