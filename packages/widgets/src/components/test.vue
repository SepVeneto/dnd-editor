<template>
  <bc-select />
</template>

<script lang="ts" setup>
import { inject, ref } from 'vue';
import { editorContextKey } from '@sepveneto/dnde-core';
const ctx = inject(editorContextKey)
console.log(ctx?.extra.obj)
</script>
