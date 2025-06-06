<template>
  <aside>
    <ElCard shadow="never">
      <ElBreadcrumb :separator-icon="ArrowRight">
        <ElBreadcrumbItem
          v-for="item in list"
          :key="item.wid"
          @click="editor.selected = item.wid"
        >
          {{ item.name }}
        </ElBreadcrumbItem>
      </ElBreadcrumb>

      <ElTabs>
        <ElTabPane label="属性">
          <div>{{ propsSchema }}</div>
        </ElTabPane>
        <ElTabPane label="样式">
          <div>{{ styleSchema }}</div>
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </aside>
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

const propsSchema = computed(() => editor.selectedNode?.widget.props)
const styleSchema = computed(() => editor.selectedNode?.widget.style)
</script>
