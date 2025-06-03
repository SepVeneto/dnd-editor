<template>
  <div>
    <ElBreadcrumb :separator-icon="ArrowRight">
      <ElBreadcrumbItem
        v-for="item in list"
        :key="item.wid"
        @click="editor.selected = item.wid"
      >
        {{ item.name }}
      </ElBreadcrumbItem>
    </ElBreadcrumb>
  </div>
</template>

<script lang="ts" setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useEditor } from '@/store'

const editor = useEditor()
const list = computed(() => {
  const nodes = [...editor.selectedNodes]
  return nodes.reverse()
})
</script>
