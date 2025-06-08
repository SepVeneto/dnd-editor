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
    :teleported="false"
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

  <div v-else>
    unknown
  </div>
</template>

<script lang="ts" setup>
import type { SchemaProp } from '@sepveneto/dnde-core/class'

defineProps<{ config: SchemaProp }>()
const model = defineModel<any>({ required: true })
</script>
