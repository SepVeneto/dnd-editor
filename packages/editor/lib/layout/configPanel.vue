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

      <ElTabs v-model="active">
        <ElTabPane
          label="属性"
          name="props"
        >
          <ConfigForm
            ref="propRef"
            v-model="editor.selectedNode.data"
            :list="propSchema"
          />
        </ElTabPane>
        <ElTabPane
          label="样式"
          name="style"
        >
          <ConfigForm
            v-model="editor.selectedNode.style"
            :list="styleSchema"
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </aside>
</template>

<script lang="ts" setup>
import { ArrowRight } from '@element-plus/icons-vue'
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import ConfigForm from '@/components/ConfigForm.vue'
import { useEditor } from '@/store'

const editor = useEditor()
const list = computed(() => {
  const nodes = [...editor.selectedNodes]
  return nodes.reverse()
})

const styleSchema = computed(() => editor.selectedNode?.widget.style)
const propSchema = computed(() => editor.selectedNode?.widget.props)

const propRef = useTemplateRef('propRef')

const active = ref<'props' | 'style'>('props')

watch(() => editor.selected, () => {
  active.value = 'props'
})

onMounted(() => {
  propRef.value?.validate()
})
</script>
