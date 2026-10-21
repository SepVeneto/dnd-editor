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
            :key="editor.selectedNode.wid"
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
            :key="editor.selectedNode.wid"
            v-model="editor.selectedNode.style"
            :list="styleSchema"
          />
        </ElScrollbar>
      </ElTabPane>

      <!--
        根节点（页面级）配置的补充标签：标签内容完全由业务侧定义，不一定是独立组件；
        若关联了固定组件，其内容配置在选中该组件后回到「属性」里编辑。
      -->
      <template v-if="isSelectRoot">
        <ElTabPane
          v-for="panel in rootConfigPanes"
          :key="panel.wid"
          :label="panel.name"
          :name="panel.wid"
        >
          <ElScrollbar
            height="700px"
            wrap-style="padding-right: 20px;"
          >
            <ConfigForm
              :ref="(ref: any) => updateRef(ref, panel.wid)"
              v-model="panel.data"
              :list="panel.widget.props"
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
import { ElBreadcrumb, ElBreadcrumbItem, ElScrollbar, ElTabPane, ElTabs } from 'element-plus'
import { computed, nextTick, onBeforeUpdate, ref, shallowRef, useTemplateRef, watch } from 'vue'
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

const isSelectRoot = computed(() => editor.selectedNode.wid === editor.rootNode.wid)
const isConfigInstance = computed(() => editor.plugins.config.list.some(panel => panel.wid === editor.selected))
// 这些标签补充的是根节点配置，在选中根节点（或关联组件）时出现
const rootConfigPanes = computed(() => (isSelectRoot.value || isConfigInstance.value ? editor.plugins.config.list : []))

watchOnce(() => editor.plugins.config.defaultPane, (paneWid) => {
  active.value = propSchema.value.length > 0 ? 'props' : paneWid
})

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

function updateRef(r: PaneInstance, name: string) {
  if (!r)
    return []

  refPageConfig.value.push({ ref: r, name })

  return refPageConfig.value.map(item => item.ref)
}

onBeforeUpdate(() => {
  refPageConfig.value.length = 0
})

defineExpose({
  async validate() {
    if (refProp.value) {
      const propValid = await refProp.value?.validate()?.catch(() => {
        active.value = 'props'
      })
      if (!propValid)
        return
    }

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

    if (refStyle.value) {
      await refStyle.value?.validate()?.catch(() => {
        active.value = 'style'
      })
    }
  },
})
</script>
