<template>
  <div>
    <ElBreadcrumb :separator-icon="ArrowRight">
      <ElBreadcrumbItem>test</ElBreadcrumbItem>
      <ElBreadcrumbItem>vv</ElBreadcrumbItem>
    </ElBreadcrumb>
  </div>
</template>

<script lang="ts" setup>
import { ArrowRight } from '@element-plus/icons-vue'
</script>
