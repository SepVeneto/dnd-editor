<template>
  <div
    style="display: flex; justify-content: flex-end;
    align-items: center;
  position: absolute;
  right: 0;
  z-index: 1;
  cursor: default;
    "
    @click.stop
  >
    <div
      style="padding: 2px 6px; background: #4089ef;font: 12px; height: 100%; margin-right: 10px;"
    >
      <ElDropdown
        :teleported="false"
        :persistent="false"
        @command="editor.selected = $event"
      >
        <div style="display: flex; align-items: center; color: #fff;">
          <ElIcon><IconWrap /></ElIcon>
          <span>{{ node.name }}</span>
        </div>
        <template #dropdown>
          <ElDropdownMenu>
            <ElDropdownItem
              v-for="item in nodes"
              :key="item.wid"
              :command="item.wid"
            >
              <span>{{ item.name }}</span>
            </ElDropdownItem>
          </ElDropdownMenu>
        </template>
      </ElDropdown>
    </div>
    <NodePlugin
      class="node-operate"
    />
  </div>
</template>

<script lang="ts" setup>
import type { Node } from '@sepveneto/dnde-core/class'
import { ScaleToOriginal as IconWrap } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useEditor } from '@/store'
import NodePlugin from './NodePlugin.vue'

defineProps<{
  node: Node
}>()

const editor = useEditor()
const nodes = computed(() => {
  return editor.selectedNodes.slice(1)
})
</script>

<style lang="scss" scoped>
.node-operate {
  display: flex;
  column-gap: 6px;
  align-items: center;
  background: #4089ef;
  padding: 4px 6px;
  color: #fff;
}
.icon-wrap {
  cursor: pointer;
}
</style>
