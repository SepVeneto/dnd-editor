<template>
  <div>
    <ElSelect
      v-model="type"
      :append-to="editor.elementRoot"
    >
      <ElOption
        label="固定值"
        value="constant"
      />
      <ElOption
        label="自适应"
        value="adaptive"
      />
    </ElSelect>

    <ElInputNumber v-model="value" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useEditor } from '@/store'

const model = defineModel()
const type = ref('adaptive')
const value = ref(0)
const editor = useEditor()
</script>
