<template>
  <div
    class="mpd-h-6 mpd-flex mpd-justify-end mpd-items-center mpd-absolute mpd-right-0 mpd-z-10 mpd-cursor-default mpd-bottom-0"
    @click.stop
  >
    <div
      class=" mpd-p-1 mpd-box-border mpd-h-full mpd-text-xs mpd-bg-primary mpd-mr-1 mpd-rounded-sm"
    >
      <ElDropdown
        :teleported="false"
        :persistent="false"
        @command="editor.selected = $event"
      >
        <div
          class="mpd-flex mpd-items-center"
          style="color: #fff;"
        >
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
      class="node-operate mpd-rounded-sm"
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
  color: #fff;
  padding: 4px;
  font-size: 14px;
  box-sizing: border-box;
  height: 100%;
}
.icon-wrap {
  cursor: pointer;
}
</style>
