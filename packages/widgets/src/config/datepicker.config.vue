<template>
  <ElInput
    v-model="model"
    type="daterange"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import { formContextKey } from 'element-plus'
import { getCurrentInstance, inject } from 'vue'

console.log(formContextKey)
const model = defineModel<string>()
const formCtx = inject(formContextKey)

console.log(getCurrentInstance())

function onChange() {
  console.log(formCtx)
}
</script>
