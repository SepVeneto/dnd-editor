<template>
  <ElInput
    v-if="config.type === 'input'"
    v-model="model"
    v-bind="config.attrs"
  />

  <ElSelect
    v-else-if="config.type === 'select'"
    v-model="model"
    v-bind="config.attrs"
  >
    <ElOption
      v-for="(item, index) in config.options"
      :key="index"
      v-bind="item"
    />
  </ElSelect>

  <ElInputNumber
    v-else-if="config.type === 'number'"
    v-model="model"
    controls-position="right"
    v-bind="config.attrs"
  />

  <StyleNumber
    v-else-if="config.type === 'styleNumber'"
    v-model="model"
  />

  <ElSwitch
    v-else-if="config.type === 'switch'"
    v-model="model"
    v-bind="config.attrs"
  />

  <component
    :is="configRender"
    v-else
    :model-value="getData(model, config.key)"
    :config="model"
    :type="config.type"
    v-bind="config.attrs"
    @update:model-value="(val: any) => {
      updateData(config.key, val)
    }"
  />
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { loadFromRemote } from '@/utils'
import StyleNumber from './StyleNumber.vue'

defineProps<{ config: SchemaItem, stylesheet: boolean }>()
const emit = defineEmits(['update:modelValue'])
const model = defineModel<any>({ required: true })

const configRender = loadFromRemote('widgets', 'componentRender')

function updateData(key: string, val: unknown) {
  const path = key.split('.')
  const _path = path.slice(0, -1)
  const parent = path.length === 1
    ? model.value
    : _path.reduce((obj, curr) => {
        return obj[curr]
      }, model.value)
  parent[path.slice(-1)[0]] = val
  emit('update:modelValue', model.value)
}
function getData(data: Record<string, any>, key: string): any {
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
  return res
}
</script>
