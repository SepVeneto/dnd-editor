<template>
  <div>
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
      v-model="active"
    >
      <ElTabPane
        label="属性"
        name="props"
      >
        <ElScrollbar
          height="700px"
          wrap-style="padding-right: 20px;"
        >
          <ConfigForm
            ref="propRef"
            v-model="editor.selectedNode.data"
            :list="propSchema"
          />
        </ElScrollbar>
      </ElTabPane>
      <ElTabPane
        v-if="styleSchema.length > 0"
        label="样式"
        name="style"
      >
        <ElScrollbar
          height="700px"
          wrap-style="padding-right: 20px;"
        >
          <ConfigForm
            ref="styleRef"
            v-model="editor.selectedNode.style"
            :list="styleSchema"
          />
        </ElScrollbar>
      </ElTabPane>
      <template v-if="isSelectRoot">
        <ElTabPane
          v-for="pane in editor.plugins.config.list"
          :key="pane.name"
          :label="pane.label"
          :name="pane.name"
        >
          <ElScrollbar
            height="700px"
            wrap-style="padding-right: 20px;"
          >
            <ConfigForm
              :ref="(ref: any) => refPageConfig.push({ ref, name: pane.name })"
              v-model="editor.selectedNode.data[pane.name]"
              :list="pane.attributes"
            />
          </ElScrollbar>
        </ElTabPane>
      </template>
    </ElTabs>
  </div>
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

const active = ref<string>('props')

watchOnce(() => editor.plugins.config.defaultPane, (name) => {
  active.value = propSchema.value.length > 0 ? 'props' : name
})

const isSelectRoot = computed(() => editor.selectedNode.wid === editor.rootNode.wid)

watch(() => editor.selected, () => {
  refPageConfig.value = []

  if (isSelectRoot.value) {
    active.value = propSchema.value.length > 0 ? 'props' : editor.plugins.config.defaultPane
  }
  else {
    active.value = 'props'
  }
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
    const propValid = await refProp.value?.validate()?.catch(() => {
      active.value = 'props'
    })
    if (!propValid)
      return

    if (refPageConfig.value) {
      for (const pane of refPageConfig.value) {
        const valid = await pane.ref.validate()?.catch(() => {
          active.value = pane.name
          return false
        })
        if (!valid)
          return
      }
    }

    await refStyle.value?.validate()?.catch(() => {
      active.value = 'style'
    })
  },
})
</script>
