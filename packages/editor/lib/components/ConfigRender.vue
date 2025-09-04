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
    v-bind="config.attrs"
  />

  <StyleNumber
    v-else-if="config.type === 'styleNumber'"
    v-model="model"
  />

  <div v-else>
    unknown
  </div>
</template>

<script lang="ts" setup>
import type { SchemaItem } from '@sepveneto/dnde-core/class'
import StyleNumber from './StyleNumber.vue'

defineProps<{ config: SchemaItem, stylesheet: boolean }>()
const model = defineModel<any>({ required: true })
</script>
