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
    v-model="model"
    :config="model"
    :type="config.type"
    v-bind="config.attrs"
  />
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import { loadFromRemote } from '@/utils'
import StyleNumber from './StyleNumber.vue'

defineProps<{ config: SchemaItem & { attrs?: any, options?: any[] }, stylesheet: boolean }>()
const model = defineModel<any>({ required: true })

const configRender = loadFromRemote('widgets', 'configRender')
</script>
