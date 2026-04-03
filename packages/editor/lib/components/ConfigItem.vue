<template>
  <ElFormItem
    :label="config.label"
    :prop="config.key"
    :rules="config.rules"
    v-bind="config.formItem"
  >
    <ConfigRender
      :model-value="getData(form, config.key)"
      :config="config"
      :data="form"
      @update:model-value="updateData(config.key, $event)"
    />
  </ElFormItem>

  <ConfigItem
    v-for="item in linkItems"
    :key="item.key"
    :config="item"
    :form="form"
  />
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { computed } from 'vue'
import ConfigRender from './ConfigRender.vue'

const props = defineProps<{
  config: SchemaItem
  form: Record<string, any>
}>()
const emit = defineEmits(['change'])

const linkItems = computed(() => {
  switch (props.config.type) {
    case 'radio':
    case 'radioButton':
    case 'select': {
      if (!props.config.link) {
        return []
      }
      return props.config.link[props.form[props.config.key]] || []
    }
    default:
      return []
  }
})

function updateData(key: string, val: unknown) {
  const path = key.split('.')
  const _path = path.slice(0, -1)
  const parent = (path.length === 1
    ? props.form
    : _path.reduce((obj, curr) => {
        if (!obj) {
          obj = {}
        }
        return obj[curr]
      }, props.form)) || {}
  parent[path.slice(-1)[0]] = val
  emit('change')
}

function getData(data: Record<string, any> | undefined, key: string): any {
  if (!data)
    return null

  const path = key.split('.')

  if (path.length === 1) {
    return data[key]
  }
  // 自动补全数据结构
  const res = path.reduce((obj, curr, index) => {
    if (!obj[curr] && index !== path.length - 1) {
      obj[curr] = {}
    }
    return obj[curr] == null ? '' : obj[curr]
  }, data)
  return res || null
}
</script>
