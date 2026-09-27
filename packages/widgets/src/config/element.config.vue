<template>
  <div>
    <ElButton @click="show = true">click me</ElButton>
    <ElDialog v-model="show">
      <ElSelect  />
    </ElDialog>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const show = ref(false)

</script>
