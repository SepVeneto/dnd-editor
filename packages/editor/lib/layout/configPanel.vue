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
            :ref="(ref: any) => refPageConfig.push({ ref, name: pane.name })"
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
import type { Raw } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { watchOnce } from '@vueuse/core'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'
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
type PaneInstance = InstanceType<typeof ConfigForm>
const refPageConfig = shallowRef<{ ref: Raw<PaneInstance>, name: string }[]>([])

const pageActive = ref()
const active = ref<'props' | 'style'>('props')

watchOnce(() => editor.plugins.config.defaultPane, (name) => {
  pageActive.value = name
})

watch(() => editor.selected, () => {
  refPageConfig.value = []

  pageActive.value = editor.plugins.config.defaultPane
  active.value = 'props'
  nextTick().then(() => {
    refPageConfig.value?.forEach((item) => {
      item?.ref?.clearValidate()
    })
    refProp.value?.clearValidate()
    refStyle.value?.clearValidate()
  })
})

defineExpose({
  async validate() {
    if (refPageConfig.value) {
      for (const pane of refPageConfig.value) {
        await pane.ref.validate()?.catch(() => {
          pageActive.value = pane.name
        })
      }
    }
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
