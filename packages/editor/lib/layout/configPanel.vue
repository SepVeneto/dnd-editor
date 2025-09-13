<template>
  <aside>
    <ElCard shadow="never">
      <ElBreadcrumb :separator-icon="ArrowRight">
        <ElBreadcrumbItem
          v-for="item in list"
          :key="item.wid"
          @click="editor.selected = item.wid"
        >
          <span class="mpd-cursor-pointer">{{ item.name }}</span>
        </ElBreadcrumbItem>
      </ElBreadcrumb>

      <ElTabs
        v-if="editor.selected === editor.rootNode.wid"
        v-model="pageActive"
      >
        <ElTabPane
          v-for="pane in editor.plugins.config.list"
          :key="pane.name"
          :label="pane.label"
          :name="pane.name"
        >
          <ConfigForm
            ref="pageConfigRef"
            v-model="editor.selectedNode.data[pane.name]"
            :list="pane.attributes"
          />
        </ElTabPane>
      </ElTabs>

      <ElTabs
        v-else
        v-model="active"
      >
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
          v-if="styleSchema.length > 0"
          label="样式"
          name="style"
        >
          <ConfigForm
            ref="styleRef"
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
import { watchOnce } from '@vueuse/core'
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import ConfigForm from '@/components/ConfigForm.vue'
import { useEditor } from '@/store'

const editor = useEditor()
const list = computed(() => {
  const nodes = [...editor.selectedNodes]
  return nodes.reverse()
})

const styleSchema = computed(() => editor.selectedNode?.widget.style)
const propSchema = computed(() => editor.selectedNode?.widget.props)

const refProp = useTemplateRef('propRef')
const refStyle = useTemplateRef('styleRef')
const refPageConfig = useTemplateRef('pageConfigRef')

const pageActive = ref()
const active = ref<'props' | 'style'>('props')

watchOnce(() => editor.plugins.config.defaultPane, (name) => {
  pageActive.value = name
})

watch(() => editor.selected, () => {
  pageActive.value = editor.plugins.config.defaultPane
  active.value = 'props'
  nextTick().then(() => {
    refPageConfig.value?.forEach((item) => {
      item?.clearValidate()
    })
    refProp.value?.clearValidate()
    refStyle.value?.clearValidate()
  })
})

defineExpose({
  async validate() {
    const propValid = await refProp.value?.validate()?.catch(() => {
      active.value = 'props'
    })
    if (!propValid)
      return

    await refStyle.value?.validate()?.catch(() => {
      active.value = 'style'
    })
  },
})
</script>
