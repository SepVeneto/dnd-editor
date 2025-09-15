import type {
  DatePickerInstance,
  ElOption,
  ImageInstance,
  InputInstance,
  InputNumberInstance,
  SelectInstance,
  SwitchInstance,
} from 'element-plus'
import type { SchemaItem } from '@/class'
import { likeArray } from '@/utils'

type Option = InstanceType<typeof ElOption>
interface BaseConfig {
  label: SchemaItem['label']
  key: SchemaItem['key']
  tips?: string
  required?: boolean | string
  rules?: SchemaItem['rules']
}

export const schema = {
  input(config: BaseConfig & { attrs?: InputInstance['$props'] }): SchemaItem {
    const base: SchemaItem = {
      label: config.label,
      key: config.key,
      type: 'input' as const,
      rules: normalizeRules(config),
      attrs: config.attrs,
    }
    return base
  },
  number(config: BaseConfig & { attrs?: InputNumberInstance['$props'] }): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: 'number',
      rules: normalizeRules(config),
      attrs: config.attrs,
    }
  },
  select(
    config: BaseConfig & { attrs?: SelectInstance['$props'], options?: Option['$props'][] },
  ): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: 'select',
      attrs: config.attrs,
      rules: normalizeRules(config),
      options: config.options,
    }
  },
  switch(config: BaseConfig & { attrs?: SwitchInstance['$props'] }): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: 'switch',
      attrs: config.attrs,
      rules: normalizeRules(config),
    }
  },
  image(config: BaseConfig & { attrs?: ImageInstance['$props'] }): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: 'image',
      attrs: config.attrs,
      rules: normalizeRules(config),
    }
  },
  time(config: BaseConfig & { attrs?: Partial<DatePickerInstance['$props']> }): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: 'datetimePicker',
      attrs: config.attrs,
      rules: normalizeRules(config),
    }
  },
  custom(config: BaseConfig & { attrs?: Record<string, any>, type: string }): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: config.type,
      attrs: config.attrs,
      rules: normalizeRules(config),
    }
  },

  styleNumber(
    config: BaseConfig,
  ): SchemaItem {
    return {
      label: config.label,
      key: config.key,
      type: 'styleNumber' as const,
      rules: normalizeRules(config),
    }
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
