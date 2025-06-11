<template>
  <aside
    style="width: 300px;"
  >
    <ElCard shadow="never">
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
import VueDraggable from 'vuedraggable'
import { useApp } from '@/store/app'

const app = useApp()

function handleClone(original: Widget) {
  const node = new Node(original)
  return node
}
</script>
