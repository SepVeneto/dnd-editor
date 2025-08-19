<template>
  <viewRender type="menuItem" />
</template>

<script setup lang="ts">
// import viewRender from './components/viewRender.vue'
import { defineAsyncComponent, getCurrentInstance } from 'vue'
const viewRender = defineAsyncComponent(() => import('./components/viewRender.vue'))
console.log(viewRender, getCurrentInstance())
</script>
