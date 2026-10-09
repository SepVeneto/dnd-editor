<template>
  <div>
    <ElButton @click="open">click me</ElButton>
  </div>
</template>

<script lang="ts" setup>
import { createDialog } from '@sepveneto/basic-comp'
import { inject, ref } from 'vue';
import { ElSelect } from 'element-plus';
import Test from '../components/test.vue';
import { editorContextKey } from '@sepveneto/dnde-core';

const show = ref(false)
const ctx = inject(editorContextKey)
console.log(ctx?.extra.obj)

function open() {
  const { open } = createDialog(Test)
  open()
}

</script>
