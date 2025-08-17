<template>
  <aside
    style="width: 300px;"
  >
    <ElTabs v-if="needTabs">
      <ElTabPane label="组件">
        <el-scrollbar
          wrap-style="height: 700px;"
          noresize
        >
          <VueDraggable
            v-model="app.widgets"
            :group="{ name: 'editor', pull: 'clone', put: false }"
            :clone="handleClone"
            :sort="false"
            item-key="name"
            class="mpd-grid mpd-grid-cols-3 mpd-gap-4"
          >
            <template #item="{ element }">
              <div
                class="mpd-flex mpd-flex-col mpd-justify-center mpd-items-center mpd-bg-gray-100 mpd-py-2 mpd-cursor-grab"
              >
                <component
                  :is="render"
                  scope="icons"
                  :type="element.icon"
                />
                <div>{{ element.name }}</div>
              </div>
            </template>
          </VueDraggable>
        </el-scrollbar>
      </ElTabPane>
      <ElTabPane
        v-for="item in editor.plugins.widget.list"
        :key="item.name"
        :label="item.label"
      >
        <component
          :is="render"
          scope="skeleton"
          :type="item.name"
        />
      </ElTabPane>
    </ElTabs>
    <ElCard
      v-else
      shadow="never"
    >
      <template #header>
        <span>组件</span>
      </template>
      <el-scrollbar
        wrap-style="height: 700px;"
        noresize
      >
        <VueDraggable
          v-model="app.widgets"
          :group="{ name: 'editor', pull: 'clone', put: false }"
          :clone="handleClone"
          :sort="false"
          item-key="name"
        >
          <template #item="{ element }">
            <div>{{ element.name }}</div>
          </template>
        </VueDraggable>
      </el-scrollbar>
    </ElCard>
  </aside>
</template>

<script lang="ts" setup>
import type { Widget } from '@sepveneto/dnde-core/class'
import { Node } from '@sepveneto/dnde-core/class'
import { computed, shallowRef, watchEffect } from 'vue'
import VueDraggable from 'vuedraggable'
import { useEditor } from '@/store'
import { useApp } from '@/store/app'
import { loadFromRemote } from '@/utils'

const app = useApp()
const editor = useEditor()

function handleClone(original: Widget) {
  const node = new Node(original)
  return node
}

const render = shallowRef()

const needTabs = computed(() => {
  return editor.plugins.widget.list.length > 0
})

watchEffect(() => {
  if (needTabs.value) {
    render.value = loadFromRemote('widgets', 'remote')
  }
})
</script>
